import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpenRouterService } from './openrouter.service';
import { TextExtractionService } from './text-extraction.service';
import { S3Service } from './s3.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prismaService: PrismaService;
  let openRouterService: OpenRouterService;
  let textExtractionService: TextExtractionService;
  let s3Service: S3Service;

  const mockDocument = {
    id: 'doc-1',
    originalName: 'test.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    s3Key: 's3/path/test.pdf',
    extractedText: 'This is test extracted text',
    summary: 'Test summary',
    docType: 'Technical Document',
    metadata: JSON.stringify({ keywords: ['test', 'pdf'] }),
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
        {
          provide: OpenRouterService,
          useValue: {
            analyzeDocument: jest.fn(),
          },
        },
        {
          provide: TextExtractionService,
          useValue: {
            extractText: jest.fn(),
          },
        },
        {
          provide: S3Service,
          useValue: {
            uploadFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    prismaService = module.get<PrismaService>(PrismaService);
    openRouterService = module.get<OpenRouterService>(OpenRouterService);
    textExtractionService = module.get<TextExtractionService>(
      TextExtractionService,
    );
    s3Service = module.get<S3Service>(S3Service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadDocument', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024,
      destination: '',
      filename: '',
      path: '',
      buffer: Buffer.from('test'),
      stream: null,
    };

    it('should successfully upload a PDF file', async () => {
      jest.spyOn(s3Service, 'uploadFile').mockResolvedValue({
        key: 's3/path/test.pdf',
      });
      jest
        .spyOn(textExtractionService, 'extractText')
        .mockResolvedValue('Extracted text');
      jest.spyOn(prismaService.document, 'create').mockResolvedValue({
        id: 'doc-1',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        s3Key: 's3/path/test.pdf',
        extractedText: 'Extracted text',
        summary: null,
        docType: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.uploadDocument(mockFile);

      expect(result).toEqual({
        id: 'doc-1',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        createdAt: expect.any(Date),
      });
      expect(s3Service.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(textExtractionService.extractText).toHaveBeenCalledWith(
        mockFile.buffer,
        mockFile.mimetype,
      );
      expect(prismaService.document.create).toHaveBeenCalled();
    });

    it('should successfully upload a DOCX file', async () => {
      const docxFile: Express.Multer.File = {
        ...mockFile,
        originalname: 'test.docx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };

      jest.spyOn(s3Service, 'uploadFile').mockResolvedValue({
        key: 's3/path/test.docx',
      });
      jest
        .spyOn(textExtractionService, 'extractText')
        .mockResolvedValue('Extracted text from docx');
      jest.spyOn(prismaService.document, 'create').mockResolvedValue({
        ...mockDocument,
        originalName: 'test.docx',
        mimeType: docxFile.mimetype,
        s3Key: 's3/path/test.docx',
        extractedText: 'Extracted text from docx',
      });

      const result = await service.uploadDocument(docxFile);

      expect(result.originalName).toBe('test.docx');
      expect(s3Service.uploadFile).toHaveBeenCalledWith(docxFile);
    });

    it('should throw error if file size exceeds 5MB', async () => {
      const largeFile: Express.Multer.File = {
        ...mockFile,
        size: 6 * 1024 * 1024,
      };

      await expect(service.uploadDocument(largeFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadDocument(largeFile)).rejects.toThrow(
        'File size must not exceed 5MB',
      );
    });

    it('should throw error if file type is not supported', async () => {
      const unsupportedFile: Express.Multer.File = {
        ...mockFile,
        mimetype: 'image/jpeg',
      };

      await expect(service.uploadDocument(unsupportedFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadDocument(unsupportedFile)).rejects.toThrow(
        'Only PDF and DOCX files are supported',
      );
    });

    it('should throw error if S3 upload fails', async () => {
      jest
        .spyOn(s3Service, 'uploadFile')
        .mockRejectedValue(new Error('S3 upload error'));

      await expect(service.uploadDocument(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('analyzeDocument', () => {
    it('should successfully analyze a document', async () => {
      const analysisResult = {
        summary: 'This is a summary of the document',
        docType: 'Technical Report',
        attributes: { keywords: ['tech', 'report'] },
      };

      jest.spyOn(prismaService.document, 'findUnique').mockResolvedValue({
        ...mockDocument,
        summary: null,
        docType: null,
        metadata: null,
      });
      jest
        .spyOn(openRouterService, 'analyzeDocument')
        .mockResolvedValue(analysisResult);
      jest.spyOn(prismaService.document, 'update').mockResolvedValue({
        ...mockDocument,
        summary: analysisResult.summary,
        docType: analysisResult.docType,
        metadata: JSON.stringify(analysisResult.attributes),
      });

      const result = await service.analyzeDocument('doc-1');

      expect(result).toEqual({
        id: mockDocument.id,
        summary: analysisResult.summary,
        docType: analysisResult.docType,
        attributes: analysisResult.attributes,
      });
      expect(prismaService.document.findUnique).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });
      expect(openRouterService.analyzeDocument).toHaveBeenCalledWith(
        mockDocument.extractedText,
      );
      expect(prismaService.document.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if document does not exist', async () => {
      jest.spyOn(prismaService.document, 'findUnique').mockResolvedValue(null);

      await expect(service.analyzeDocument('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.analyzeDocument('non-existent-id')).rejects.toThrow(
        'Document not found',
      );
    });

    it('should throw BadRequestException if no extracted text', async () => {
      jest.spyOn(prismaService.document, 'findUnique').mockResolvedValue({
        ...mockDocument,
        extractedText: null,
      });

      await expect(service.analyzeDocument('doc-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.analyzeDocument('doc-1')).rejects.toThrow(
        'No extracted text found for this document',
      );
    });

    it('should throw error if analysis fails', async () => {
      jest.spyOn(prismaService.document, 'findUnique').mockResolvedValue({
        ...mockDocument,
        extractedText: 'Some text',
      });
      jest
        .spyOn(openRouterService, 'analyzeDocument')
        .mockRejectedValue(new Error('API error'));

      await expect(service.analyzeDocument('doc-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDocument', () => {
    it('should return combined document data', async () => {
      jest
        .spyOn(prismaService.document, 'findUnique')
        .mockResolvedValue(mockDocument);

      const result = await service.getDocument('doc-1');

      expect(result).toEqual({
        fileInfo: {
          id: mockDocument.id,
          originalName: mockDocument.originalName,
          mimeType: mockDocument.mimeType,
          size: mockDocument.size,
          s3Key: mockDocument.s3Key,
          createdAt: mockDocument.createdAt,
          updatedAt: mockDocument.updatedAt,
        },
        text: mockDocument.extractedText,
        summary: mockDocument.summary,
        docType: mockDocument.docType,
        metadata: { keywords: ['test', 'pdf'] },
      });
      expect(prismaService.document.findUnique).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });
    });

    it('should return null for optional fields when not set', async () => {
      jest.spyOn(prismaService.document, 'findUnique').mockResolvedValue({
        ...mockDocument,
        extractedText: null,
        summary: null,
        docType: null,
        metadata: null,
      });

      const result = await service.getDocument('doc-1');

      expect(result.text).toBeNull();
      expect(result.summary).toBeNull();
      expect(result.docType).toBeNull();
      expect(result.metadata).toBeNull();
    });

    it('should throw NotFoundException if document does not exist', async () => {
      jest.spyOn(prismaService.document, 'findUnique').mockResolvedValue(null);

      await expect(service.getDocument('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getDocument('non-existent-id')).rejects.toThrow(
        'Document not found',
      );
    });

    it('should parse metadata JSON correctly', async () => {
      const complexMetadata = {
        keywords: ['test', 'pdf'],
        sections: ['intro', 'body', 'conclusion'],
        author: 'Test Author',
      };

      jest.spyOn(prismaService.document, 'findUnique').mockResolvedValue({
        ...mockDocument,
        metadata: JSON.stringify(complexMetadata),
      });

      const result = await service.getDocument('doc-1');

      expect(result.metadata).toEqual(complexMetadata);
    });
  });
});
