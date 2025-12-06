import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
  ) {}

  async uploadDocument(file: Express.Multer.File) {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size must not exceed 5MB');
    }

    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only PDF and DOCX files are supported',
      );
    }

    try {
      const { key } = await this.s3Service.uploadFile(file);


      const document = await this.prisma.document.create({
        data: {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          s3Key: key,
        },
      });

      return {
        id: document.id,
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size,
        createdAt: document.createdAt,
      };
    } catch (error) {
      throw new BadRequestException(
        `Upload failed: ${error.message}`,
      );
    }
  }
}
