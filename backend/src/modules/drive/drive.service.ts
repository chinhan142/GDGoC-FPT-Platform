import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drive_v3, google } from 'googleapis';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class DriveService implements OnModuleInit {
  private readonly logger = new Logger(DriveService.name);
  private drive: drive_v3.Drive;

  constructor(private readonly configService: ConfigService) {}

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
  async createEventFolder(dto: CreateEventDto) {
    const { eventName, eventDate } = dto;
    const parentFolderName = `[${eventDate}-${eventName}]`;
    this.logger.log(`Creating parent folder: ${parentFolderName}`);

    const parentFolder = await this.createFolder(parentFolderName);

    const subFolderNames = [
      '01-Design-Assets',
      '02-Photos-Raw',
      '03-Slide-Speaker',
      '04-Proposal-KichBan',
    ];

    // Helps creates those sub folders base on the sub folder names
    const subFolders = await Promise.all(
      subFolderNames.map((subName) =>
        this.createFolder(subName, parentFolder.id!),
      ),
    );

    return {
      message: 'Create event folder tree successfully!',
      eventFolder: {
        id: parentFolder.id,
        name: parentFolder.name,
        link: parentFolder.webViewLink,
      },
      subFolders: subFolders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        link: folder.webViewLink,
      })),
    };
  }
}
