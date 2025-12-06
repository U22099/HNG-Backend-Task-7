import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.documentsService.uploadDocument(file);
  }

  @Post(':id/analyze')
  async analyzeDocument(@Param('id') id: string) {
    return this.documentsService.analyzeDocument(id);
  }

  @Get(':id')
  async getDocument(@Param('id') id: string) {
    return this.documentsService.getDocument(id);
  }
}
