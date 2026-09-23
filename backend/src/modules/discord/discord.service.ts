import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  ChatInputCommandInteraction,
  ChannelType,
} from 'discord.js';

export interface TaskAssigneeWithUser {
  role: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
    discordId?: string | null;
    avatarUrl?: string | null;
  } | null;
}

export interface TaskWithRelations {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  deadline: Date | string;
  gemsReward: number;
  departmentId: string;
  department?: {
    name: string;
    discordChannelId?: string | null;
  } | null;
  assignees?: TaskAssigneeWithUser[];
}

@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);
  private client: Client | null = null;
  private isReady = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const token =
      this.configService.get<string>('DISCORD_BOT_TOKEN') ||
      process.env.DISCORD_BOT_TOKEN;

    if (!token) {
      this.logger.warn(
        'DISCORD_BOT_TOKEN is not provided. Discord Bot will run in offline mode.',
      );
      return;
    }

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers,
        ],
      });

      this.client.on('ready', () => {
        this.isReady = true;
        this.logger.log(
          `Discord Bot logged in as ${this.client?.user?.tag} (${this.client?.user?.id})`,
        );
        void this.registerSlashCommands();
      });

      this.client.on('interactionCreate', (interaction) => {
        if (interaction.isChatInputCommand()) {
          void this.handleSlashCommand(interaction);
        }
      });

      await this.client.login(token);
    } catch (error) {
      this.logger.error('Failed to connect Discord Bot:', error);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.destroy();
      this.logger.log('Discord Bot client destroyed.');
    }
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  /**
   * Register Slash Commands (/tasks, /profile) to Discord API
   */
  public async registerSlashCommands() {
    const token =
      this.configService.get<string>('DISCORD_BOT_TOKEN') ||
      process.env.DISCORD_BOT_TOKEN;
    const clientId =
      this.configService.get<string>('DISCORD_CLIENT_ID') ||
      this.client?.user?.id;
    const guildId = this.configService.get<string>('DISCORD_GUILD_ID');

    if (!token || !clientId) {
      this.logger.warn(
        'Skipping slash command registration: Missing token or client ID.',
      );
      return;
    }

    const commands = [
      new SlashCommandBuilder()
        .setName('tasks')
        .setDescription(
          'Tra cứu danh sách công việc được phân công trên GDGoC-OS',
        ),
      new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Tra cứu hồ sơ cá nhân và số dư Gems trên GDGoC-OS'),
    ].map((cmd) => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(token);

    try {
      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
          body: commands,
        });
        this.logger.log(
          `Successfully registered ${commands.length} slash commands for Guild ${guildId}`,
        );
      } else {
        await rest.put(Routes.applicationCommands(clientId), {
          body: commands,
        });
        this.logger.log(
          `Successfully registered ${commands.length} global slash commands`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to register slash commands:', error);
    }
  }

  /**
   * Handle incoming slash commands
   */
  private async handleSlashCommand(interaction: ChatInputCommandInteraction) {
    const { commandName, user } = interaction;

    try {
      if (commandName === 'tasks') {
        await this.handleTasksCommand(interaction, user.id);
      } else if (commandName === 'profile') {
        await this.handleProfileCommand(interaction, user.id);
      }
    } catch (error) {
      this.logger.error(`Error handling command ${commandName}:`, error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: 'Đã xảy ra lỗi khi xử lý câu lệnh.',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'Đã xảy ra lỗi khi xử lý câu lệnh.',
          ephemeral: true,
        });
      }
    }
  }

  /**
   * /tasks command handler
   */
  private async handleTasksCommand(
    interaction: ChatInputCommandInteraction,
    discordId: string,
  ) {
    await interaction.deferReply({ ephemeral: true });

    const dbUser = await this.prisma.user.findUnique({
      where: { discordId },
      include: {
        assignedTasks: {
          include: {
            task: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    });

    if (!dbUser) {
      await interaction.editReply({
        content:
          '⚠️ **Tài khoản Discord của bạn chưa được liên kết với GDGoC Platform!**\nVui lòng cập nhật discordId trong hồ sơ cá nhân trên hệ thống Web.',
      });
      return;
    }

    const assigned = dbUser.assignedTasks.map((at) => at.task);

    if (assigned.length === 0) {
      await interaction.editReply({
        content: `📋 **Chào ${dbUser.fullName}!** Bạn hiện không có công việc nào được gán.`,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 Danh sách công việc của ${dbUser.fullName}`)
      .setColor('#4285F4')
      .setTimestamp();

    const priorityColors: Record<string, string> = {
      URGENT: '🔴 URGENT',
      HIGH: '🟠 HIGH',
      MEDIUM: '🟡 MEDIUM',
      LOW: '🟢 LOW',
    };

    const statusIcons: Record<string, string> = {
      BACKLOG: '📦 Backlog',
      TODO: '📝 To Do',
      IN_PROGRESS: '⚙️ In Progress',
      IN_REVIEW: '🔍 In Review',
      DONE: '✅ Done',
      OVERDUE: '🚨 Overdue',
    };

    const fields = assigned.slice(0, 10).map((t) => {
      const deadlineStr = new Date(t.deadline).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      return {
        name: `${statusIcons[t.status] || t.status} - ${t.title}`,
        value: `**Ban**: ${t.department.name} | **Ưu tiên**: ${priorityColors[t.priority] || t.priority}\n**Deadline**: ${deadlineStr} | **Phần thưởng**: 💎 ${t.gemsReward} Gems`,
        inline: false,
      };
    });

    embed.addFields(fields);
    if (assigned.length > 10) {
      embed.setFooter({
        text: `Hiển thị 10 / ${assigned.length} công việc. Xem thêm trên Web Platform!`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * /profile command handler
   */
  private async handleProfileCommand(
    interaction: ChatInputCommandInteraction,
    discordId: string,
  ) {
    await interaction.deferReply({ ephemeral: true });

    const dbUser = await this.prisma.user.findUnique({
      where: { discordId },
      include: {
        tenures: {
          include: {
            department: true,
            tenure: true,
          },
        },
        assignedTasks: {
          include: {
            task: true,
          },
        },
      },
    });

    if (!dbUser) {
      await interaction.editReply({
        content:
          '⚠️ **Tài khoản Discord của bạn chưa được liên kết với GDGoC Platform!**\nVui lòng cập nhật discordId trong hồ sơ cá nhân.',
      });
      return;
    }

    const currentTenure = dbUser.tenures[0];
    const deptName = currentTenure?.department?.name || 'N/A';
    const roleName = currentTenure?.role || 'MEMBER';
    const doneTasksCount = dbUser.assignedTasks.filter(
      (at) => at.task.status === 'DONE',
    ).length;

    const embed = new EmbedBuilder()
      .setTitle(`👤 Hồ sơ thành viên: ${dbUser.fullName}`)
      .setColor('#34A853')
      .setThumbnail(dbUser.avatarUrl || interaction.user.displayAvatarURL())
      .addFields(
        { name: '🆔 MSSV', value: dbUser.mssv || 'N/A', inline: true },
        { name: '📧 Email', value: dbUser.email, inline: true },
        { name: '🏛️ Ban chuyên môn', value: deptName, inline: true },
        { name: '🎖️ Vai trò', value: roleName, inline: true },
        {
          name: '💎 Số dư Gems',
          value: `**${dbUser.gemsBalance}** Gems`,
          inline: true,
        },
        {
          name: '✅ Task đã hoàn thành',
          value: `${doneTasksCount} công việc`,
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * Hero Feature: Create a discussion thread for a new Task on Discord
   */
  public async createTaskThread(
    task: TaskWithRelations,
  ): Promise<string | null> {
    if (!this.client || !this.isReady) {
      this.logger.warn(
        'Discord Bot is not connected or ready. Skipping thread creation.',
      );
      return null;
    }

    const channelId = task.department?.discordChannelId;
    if (!channelId) {
      this.logger.warn(
        `Department ${task.department?.name || task.departmentId} has no discordChannelId configured.`,
      );
      return null;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (
        !channel ||
        (channel.type !== ChannelType.GuildText &&
          channel.type !== ChannelType.GuildAnnouncement)
      ) {
        this.logger.warn(
          `Discord channel ${channelId} is invalid or not a text channel.`,
        );
        return null;
      }

      const anyChannel = channel as any;

      // Create a thread
      const thread = await anyChannel.threads.create({
        name: `📌 [Task] ${task.title.slice(0, 90)}`,
        autoArchiveDuration: 10080, // 7 days
        reason: `Automated thread creation for Task: ${task.title}`,
      });

      const priorityColors: Record<string, number> = {
        URGENT: 0xea4335, // Red
        HIGH: 0xff6d00, // Orange
        MEDIUM: 0xfbbc04, // Yellow
        LOW: 0x4285f4, // Blue
      };

      const deadlineFormatted = new Date(task.deadline).toLocaleString(
        'vi-VN',
        {
          timeZone: 'Asia/Ho_Chi_Minh',
          dateStyle: 'medium',
          timeStyle: 'short',
        },
      );

      const embed = new EmbedBuilder()
        .setTitle(`📋 ${task.title}`)
        .setDescription(task.description || '_Không có mô tả chi tiết._')
        .setColor(priorityColors[task.priority] || 0x4285f4)
        .addFields(
          { name: '🔥 Mức độ ưu tiên', value: task.priority, inline: true },
          { name: '⏰ Hạn chót', value: deadlineFormatted, inline: true },
          {
            name: '💎 Phần thưởng',
            value: `${task.gemsReward} Gems`,
            inline: true,
          },
          {
            name: '🏛️ Ban',
            value: task.department?.name || 'Chung',
            inline: true,
          },
          { name: '📊 Trạng thái', value: task.status, inline: true },
        )
        .setFooter({ text: 'GDGoC FPT Platform • Task Management' })
        .setTimestamp();

      // Format mentions
      const primaryMentions: string[] = [];
      const memberMentions: string[] = [];

      if (task.assignees && Array.isArray(task.assignees)) {
        for (const assignee of task.assignees) {
          const u = assignee.user;
          const mentionText = u?.discordId
            ? `<@${u.discordId}>`
            : `@${u?.fullName || 'User'}`;
          if (assignee.role === 'PRIMARY') {
            primaryMentions.push(mentionText);
          } else {
            memberMentions.push(mentionText);
          }
        }
      }

      let mentionContent = '🔔 **Phân công công việc:**\n';
      if (primaryMentions.length > 0) {
        mentionContent += `👑 **Chủ trì (Primary):** ${primaryMentions.join(', ')}\n`;
      }
      if (memberMentions.length > 0) {
        mentionContent += `👥 **Thành viên hỗ trợ (Member):** ${memberMentions.join(', ')}\n`;
      }

      await thread.send({
        content: mentionContent,
        embeds: [embed],
      });

      this.logger.log(
        `Created Discord thread "${thread.name}" (${thread.id}) for Task ${task.id}`,
      );
      return thread.id;
    } catch (error) {
      this.logger.error(
        `Failed to create Discord thread for task ${task.id}:`,
        error,
      );
      return null;
    }
  }
}
