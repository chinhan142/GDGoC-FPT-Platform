import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drive_v3, google } from 'googleapis';
import { CreateEventFolderDto } from './dto/create-event-folder';
import { PrismaService } from '../../prisma/prisma.service';
import { DepartmentType, DriveCategory } from '@prisma/client';

@Injectable()
export class DriveService implements OnModuleInit {
  /**
   * Folder Blueprint Config
   * Note: This section may remove to the admin config in the future!
   */
  EVENT_FOLDER_BLUEPRINT = [
    {
      folderName: '01-Design-Assets',
      category: DriveCategory.MEDIA_VAULT,
      departmentCode: DepartmentType.MEDIA,
    },
    {
      folderName: '02-Photos-Raw',
      category: DriveCategory.MEDIA_VAULT,
      departmentCode: DepartmentType.MEDIA,
    },
    {
      folderName: '03-Slide-Speaker',
      category: DriveCategory.TECH_LIBRARY,
      departmentCode: DepartmentType.TECH_AI,
    },
    {
      folderName: '04-Proposal-KichBan',
      category: DriveCategory.PR_COMMS,
      departmentCode: DepartmentType.HR_EVENT,
    },
  ];

  private readonly logger = new Logger(DriveService.name);
  private drive: drive_v3.Drive;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   *    This function helps initialize the connection to the drive service of google apis with given secret key
   * @returns Log out terminal when connecting successfully!
   */
  onModuleInit() {
    const clientEmail = this.configService.get<string>(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    );
    let privateKey = this.configService.get<string>('GOOGLE_PRIVATE_KEY');

    if (!clientEmail || !privateKey) {
      this.logger.warn('Missing variable configuration in .env!');
      return;
    }

    privateKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    this.drive = google.drive({ version: 'v3', auth });
    this.logger.log(' Google Drive Service Account intialized successfully!');
  }

  /**
   * This function helps create a single folder base on your need
   * @param name the name of the folder you want to create
   * @param parentFolderId the parent folder id. If this exists, the function will create the sub folder inside the given folder id, otherwise just create the single folder
   * @returns the response of the created folder including id, name and web view link that lead to the drive folder
   */
  async createFolder(name: string, parentFolderId?: string) {
    if (!this.drive) {
      throw new InternalServerErrorException(
        'Google Drive Service is not initialized! Recheck .env key',
      );
    }

    const parentId =
      parentFolderId ||
      this.configService.get<string>('GOOGLE_DRIVE_MASTER_FOLDER_ID');

    // Create folder methods, google sees those folder as files format and they assign each folder with an id therefore we're using drive.files.create instead of drive.folders.create
    const response = await this.drive.files.create({
      requestBody: {
        name: name,
        // Identify the type of the files, in this case is folder, in other case you can switch to .document or .spreadsheet base on your needs
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : [],
      },
      fields: 'id, name, webViewLink',
    });

    return response.data;
  }

  /**
   * This function helps create sub folders structure base on given event info like name and date
   * @param eventName The event name
   * @param eventDate The event date in the format of YYYY-MM-DD
   * @returns The original parent folder metadata and the followed sub folder inside the parent folder
   */
  async createEventFolder(dto: CreateEventFolderDto) {
    const event = await this.prisma.event.findUnique({
      where: {
        id: dto.eventId,
      },
    });

    if (!event) {
      throw new NotFoundException('This event does not exist!');
    }

    if (event.driveFolderUrl) {
      throw new ConflictException("This event's folders is already exist!");
    }

    const eventName = event.title;
    const eventDate = event.startTime.toISOString().split('T')[0];

    const parentFolderName = `[${eventDate}-${eventName}]`;
    this.logger.log(`Creating parent folder: ${parentFolderName}`);

    const parentFolder = await this.createFolder(parentFolderName);

    // Create subfolder operation
    const createdSubFolders = await Promise.all(
      this.EVENT_FOLDER_BLUEPRINT.map(async (item) => {
        const driveFolder = await this.createFolder(
          item.folderName,
          parentFolder.id,
        );

        return {
          folderName: item.folderName,
          category: item.category,
          departmentCode: item.departmentCode,
          driveFileId: driveFolder.id!,
          driveUrl: driveFolder.webViewLink!,
        };
      }),
    );

    const departments = await this.prisma.department.findMany();
    const deptMap = new Map((await departments).map((d) => [d.code, d.id]));

    await this.prisma.driveAsset.createMany({
      data: createdSubFolders.map((sub) => ({
        name: `[${event.title}] - ${sub.folderName}`,
        category: sub.category,
        driveUrl: sub.driveUrl,
        driveFileId: sub.driveFileId,
        tenureId: event.tenureId,
        eventId: event.id,
        departmentId: deptMap.get(sub.departmentCode) || null,
      })),
    });

    await this.prisma.event.update({
      where: {
        id: event.id,
      },
      data: {
        driveFolderUrl: parentFolder.webViewLink,
      },
    });

    return {
      message: "Create event's folder tree and drive asset succesfully!",
      parentFolder: {
        id: parentFolder.id,
        name: parentFolder.name,
        link: parentFolder.webViewLink,
      },
      subFolders: createdSubFolders.map((sub) => ({
        name: sub.folderName,
        id: sub.driveFileId,
        link: sub.driveUrl,
        category: sub.category,
      })),
    };
  }
}
