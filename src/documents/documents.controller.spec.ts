import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: DocumentsService;

  const mockDocument = {
    id: 'doc-1',
    originalName: 'test.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    createdAt: new Date(),
  };

  const mockDocumentWithDetails = {
    fileInfo: {
      id: 'doc-1',
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      s3Key: 's3/path/test.pdf',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    text: 'This is extracted text',
    summary: 'This is a summary',
    docType: 'Technical Document',
    metadata: { keywords: ['test', 'pdf'] },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: DocumentsService,
          useValue: {
            uploadDocument: jest.fn(),
            analyzeDocument: jest.fn(),
            getDocument: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
    service = module.get<DocumentsService>(DocumentsService);
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

    it('should successfully upload a document', async () => {
      jest.spyOn(service, 'uploadDocument').mockResolvedValue(mockDocument);

      const result = await controller.uploadDocument(mockFile);

      expect(result).toEqual(mockDocument);
      expect(service.uploadDocument).toHaveBeenCalledWith(mockFile);
    });

    it('should throw BadRequestException if no file is provided', async () => {
      await expect(controller.uploadDocument(null)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.uploadDocument(null)).rejects.toThrow(
        'No file uploaded',
      );
    });

    it('should throw BadRequestException if upload fails', async () => {
      jest
        .spyOn(service, 'uploadDocument')
        .mockRejectedValue(
          new BadRequestException('File size must not exceed 5MB'),
        );

      await expect(controller.uploadDocument(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('analyzeDocument', () => {
    const analysisResult = {
      id: 'doc-1',
      summary: 'Test summary',
      docType: 'Technical Document',
      attributes: { keywords: ['test'] },
    };

    it('should successfully analyze a document', async () => {
      jest.spyOn(service, 'analyzeDocument').mockResolvedValue(analysisResult);

      const result = await controller.analyzeDocument('doc-1');

      expect(result).toEqual(analysisResult);
      expect(service.analyzeDocument).toHaveBeenCalledWith('doc-1');
    });

    it('should throw NotFoundException if document does not exist', async () => {
      jest
        .spyOn(service, 'analyzeDocument')
        .mockRejectedValue(new NotFoundException('Document not found'));

      await expect(
        controller.analyzeDocument('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if analysis fails', async () => {
      jest
        .spyOn(service, 'analyzeDocument')
        .mockRejectedValue(
          new BadRequestException('Analysis failed: API error'),
        );

      await expect(controller.analyzeDocument('doc-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDocument', () => {
    it('should return combined document data', async () => {
      jest
        .spyOn(service, 'getDocument')
        .mockResolvedValue(mockDocumentWithDetails);

      const result = await controller.getDocument('doc-1');

      expect(result).toEqual(mockDocumentWithDetails);
      expect(service.getDocument).toHaveBeenCalledWith('doc-1');
    });

    it('should return document with null optional fields', async () => {
      const documentWithoutAnalysis = {
        fileInfo: {
          id: 'doc-1',
          originalName: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          s3Key: 's3/path/test.pdf',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        text: 'Extracted text',
        summary: null,
        docType: null,
        metadata: null,
      };

      jest
        .spyOn(service, 'getDocument')
        .mockResolvedValue(documentWithoutAnalysis);

      const result = await controller.getDocument('doc-1');

      expect(result.summary).toBeNull();
      expect(result.docType).toBeNull();
      expect(result.metadata).toBeNull();
      expect(result.text).not.toBeNull();
    });

    it('should throw NotFoundException if document does not exist', async () => {
      jest
        .spyOn(service, 'getDocument')
        .mockRejectedValue(new NotFoundException('Document not found'));

      await expect(controller.getDocument('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getDocument('non-existent-id')).rejects.toThrow(
        'Document not found',
      );
    });

    it('should correctly parse and return metadata', async () => {
      jest
        .spyOn(service, 'getDocument')
        .mockResolvedValue(mockDocumentWithDetails);

      const result = await controller.getDocument('doc-1');

      expect(result.metadata).toEqual({ keywords: ['test', 'pdf'] });
      expect(typeof result.metadata).toBe('object');
    });

    it('should include all required file information fields', async () => {
      jest
        .spyOn(service, 'getDocument')
        .mockResolvedValue(mockDocumentWithDetails);

      const result = await controller.getDocument('doc-1');

      expect(result.fileInfo).toHaveProperty('id');
      expect(result.fileInfo).toHaveProperty('originalName');
      expect(result.fileInfo).toHaveProperty('mimeType');
      expect(result.fileInfo).toHaveProperty('size');
      expect(result.fileInfo).toHaveProperty('s3Key');
      expect(result.fileInfo).toHaveProperty('createdAt');
      expect(result.fileInfo).toHaveProperty('updatedAt');
    });

    it('should return document id in request parameter', async () => {
      jest
        .spyOn(service, 'getDocument')
        .mockResolvedValue(mockDocumentWithDetails);

      const documentId = 'specific-doc-id';
      await controller.getDocument(documentId);

      expect(service.getDocument).toHaveBeenCalledWith(documentId);
    });
  });

  describe('Integration: Upload -> Analyze -> Get flow', () => {
    it('should follow complete document lifecycle', async () => {
      const uploadResult = mockDocument;
      const analysisResult = {
        id: 'doc-1',
        summary: 'Test summary',
        docType: 'Technical Document',
        attributes: { keywords: ['test'] },
      };
      const getResult = mockDocumentWithDetails;

      jest.spyOn(service, 'uploadDocument').mockResolvedValue(uploadResult);
      jest.spyOn(service, 'analyzeDocument').mockResolvedValue(analysisResult);
      jest.spyOn(service, 'getDocument').mockResolvedValue(getResult);

      // Upload
      const uploaded = await controller.uploadDocument(
        mockFile as Express.Multer.File,
      );
      expect(uploaded.id).toBe('doc-1');

      // Analyze
      const analyzed = await controller.analyzeDocument(uploaded.id);
      expect(analyzed.summary).toBeDefined();

      // Get
      const retrieved = await controller.getDocument(analyzed.id);
      expect(retrieved).toEqual(getResult);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const error = new Error('Unexpected service error');
      jest.spyOn(service, 'getDocument').mockRejectedValue(error);

      await expect(controller.getDocument('doc-1')).rejects.toThrow(error);
    });

    it('should validate document ID format in get request', async () => {
      // This test verifies the controller passes the ID correctly
      jest
        .spyOn(service, 'getDocument')
        .mockResolvedValue(mockDocumentWithDetails);

      const specialId = 'doc-with-special-chars-123';
      await controller.getDocument(specialId);

      expect(service.getDocument).toHaveBeenCalledWith(specialId);
    });
  });
});
