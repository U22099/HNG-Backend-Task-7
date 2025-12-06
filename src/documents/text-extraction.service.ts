import { Injectable, BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

@Injectable()
export class TextExtractionService {
  async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({
        data: buffer,
      });
      const data = await parser.getText();
      return data.text || '';
    } catch (error) {
      throw new BadRequestException(
        `Failed to extract text from PDF: ${error}`,
      );
    }
  }

  async extractTextFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (error) {
      throw new BadRequestException(
        `Failed to extract text from DOCX: ${error}`,
      );
    }
  }

  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'application/pdf') {
      return this.extractTextFromPDF(buffer);
    } else if (
      mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return this.extractTextFromDOCX(buffer);
    } else {
      throw new BadRequestException('Only PDF and DOCX files are supported');
    }
  }
}
