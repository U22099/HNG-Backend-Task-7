import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenRouterService } from './openrouter.service';
import { TextExtractionService } from './text-extraction.service';
import { S3Service } from './s3.service';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private openRouterService: OpenRouterService,
    private textExtractionService: TextExtractionService,
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

      const extractedText = await this.textExtractionService.extractText(
        file.buffer,
        file.mimetype,
      );

      const document = await this.prisma.document.create({
        data: {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          s3Key: key,
          extractedText,
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

  async analyzeDocument(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (!document.extractedText) {
      throw new BadRequestException(
        'No extracted text found for this document',
      );
    }

    try {
      const analysis = await this.openRouterService.analyzeDocument(
        document.extractedText,
      );

      const updated = await this.prisma.document.update({
        where: { id },
        data: {
          summary: analysis.summary,
          docType: analysis.docType,
          metadata: JSON.stringify(analysis.attributes),
        },
      });

      return {
        id: updated.id,
        summary: updated.summary,
        docType: updated.docType,
        attributes: analysis.attributes,
      };
    } catch (error) {
      throw new BadRequestException(
        `Analysis failed: ${error.message}`,
      );
    }
  }
}
