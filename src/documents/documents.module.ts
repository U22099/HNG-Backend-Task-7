import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { TextExtractionService } from './text-extraction.service';
import { S3Service } from './s3.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    S3Service,
    TextExtractionService,
    PrismaService,
  ],
})
export class DocumentsModule {}
