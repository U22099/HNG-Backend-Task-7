import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpenRouterService } from './openrouter.service';
import { TextExtractionService } from './text-extraction.service';
import { S3Service } from './s3.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: jest.Mocked<PrismaService['document']>;
  let s3: jest.Mocked<S3Service>;
  let textExtract: jest.Mocked<TextExtractionService>;
  let openRouter: jest.Mocked<OpenRouterService>;

  const mockFile = {
    originalname: 'test.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('fake pdf'),
  } as Express.Multer.File;

  const dbDoc = {
    id: 'doc-1',
    originalName: 'test.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    s3Key: 'uploads/doc-1.pdf',
    extractedText: 'Full text here',
    summary: null,
    docType: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: PrismaService,
          useValue: {
            document: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        { provide: S3Service, useValue: { uploadFile: jest.fn() } },
        {
          provide: TextExtractionService,
          useValue: { extractText: jest.fn() },
        },
        {
          provide: OpenRouterService,
          useValue: { analyzeDocument: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(DocumentsService);
    prisma = module.get(PrismaService).document as any;
    s3 = module.get(S3Service);
    textExtract = module.get(TextExtractionService);
    openRouter = module.get(OpenRouterService);
  });

  describe('uploadDocument', () => {
    it('should upload PDF successfully and save to DB', async () => {
      s3.uploadFile.mockResolvedValue({ key: 'uploads/doc-1.pdf', url: '' });
      textExtract.extractText.mockResolvedValue('Full text here');
      prisma.create.mockResolvedValue({ ...dbDoc, id: 'doc-1' });

      const result = await service.uploadDocument(mockFile);

      expect(result.id).toBe('doc-1');
      expect(result.originalName).toBe('test.pdf');
      expect(s3.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(textExtract.extractText).toHaveBeenCalledWith(
        mockFile.buffer,
        mockFile.mimetype,
      );
      expect(prisma.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            originalName: 'test.pdf',
            extractedText: 'Full text here',
          }),
        }),
      );
    });

    it('should support DOCX files', async () => {
      const docx = {
        ...mockFile,
        originalname: 'report.docx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      s3.uploadFile.mockResolvedValue({ key: 'uploads/report.docx', url: '' });
      textExtract.extractText.mockResolvedValue('DOCX content');
      prisma.create.mockResolvedValue({
        ...dbDoc,
        originalName: 'report.docx',
      });

      await service.uploadDocument(docx);
      expect(s3.uploadFile).toHaveBeenCalledWith(docx);
    });

    it('should reject files > 5MB', async () => {
      const bigFile = { ...mockFile, size: 6 * 1024 * 1024 };
      await expect(service.uploadDocument(bigFile)).rejects.toThrow(
        'File size must not exceed 5MB',
      );
    });

    it('should reject unsupported mime types', async () => {
      const img = { ...mockFile, mimetype: 'image/png' };
      await expect(service.uploadDocument(img)).rejects.toThrow(
        'Only PDF and DOCX',
      );
    });

    it('should fail if S3 upload fails', async () => {
      s3.uploadFile.mockRejectedValue(new Error('S3 error'));
      await expect(service.uploadDocument(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('analyzeDocument', () => {
    it('should analyze text and update document', async () => {
      prisma.findUnique.mockResolvedValue({
        ...dbDoc,
        extractedText: 'Some text',
      });
      openRouter.analyzeDocument.mockResolvedValue({
        summary: 'AI summary',
        docType: 'Invoice',
        attributes: { keywords: ['bill', '2025'] },
      });
      prisma.update.mockResolvedValue({} as any);

      const result = await service.analyzeDocument('doc-1');

      expect(result.summary).toBe('AI summary');
      expect(result.docType).toBe('Invoice');
      expect(result.attributes).toEqual({ keywords: ['bill', '2025'] });
      expect(openRouter.analyzeDocument).toHaveBeenCalledWith('Some text');
      expect(prisma.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          data: expect.objectContaining({
            metadata: JSON.stringify({ keywords: ['bill', '2025'] }),
          }),
        }),
      );
    });

    it('should throw if document not found', async () => {
      prisma.findUnique.mockResolvedValue(null);
      await expect(service.analyzeDocument('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if no extracted text', async () => {
      prisma.findUnique.mockResolvedValue({ ...dbDoc, extractedText: null });
      await expect(service.analyzeDocument('doc-1')).rejects.toThrow(
        'No extracted text',
      );
    });
  });

  describe('getDocument', () => {
    it('should return full document with parsed metadata', async () => {
      prisma.findUnique.mockResolvedValue({
        ...dbDoc,
        summary: 'Short summary',
        docType: 'Report',
        metadata: JSON.stringify({ keywords: ['ai', 'test'], author: 'John' }),
      });

      const result = await service.getDocument('doc-1');

      expect(result.fileInfo.originalName).toBe('test.pdf');
      expect(result.text).toBe('Full text here');
      expect(result.summary).toBe('Short summary');
      expect(result.metadata).toEqual({
        keywords: ['ai', 'test'],
        author: 'John',
      });
    });

    it('should return nulls for missing optional fields', async () => {
      prisma.findUnique.mockResolvedValue({
        ...dbDoc,
        extractedText: 'text',
        summary: null,
        docType: null,
        metadata: null,
      });

      const result = await service.getDocument('doc-1');
      expect(result.summary).toBeNull();
      expect(result.docType).toBeNull();
      expect(result.metadata).toBeNull();
    });

    it('should throw NotFound if document missing', async () => {
      prisma.findUnique.mockResolvedValue(null);
      await expect(service.getDocument('gone')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
