import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: jest.Mocked<DocumentsService>;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('fake pdf'),
  } as any;

  const mockDoc = {
    id: 'doc-1',
    originalName: 'test.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockFullDoc = {
    fileInfo: {
      ...mockDoc,
      s3Key: 'path/test.pdf',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    text: 'extracted text',
    summary: 'summary',
    docType: 'Technical',
    metadata: { keywords: ['test'] },
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

    controller = module.get(DocumentsController);
    service = module.get(DocumentsService);
  });

  it('should upload document successfully', async () => {
    service.uploadDocument.mockResolvedValue(mockDoc);
    expect(await controller.uploadDocument(mockFile)).toEqual(mockDoc);
    expect(service.uploadDocument).toHaveBeenCalledWith(mockFile);
  });

  it('should throw BadRequest if no file uploaded', async () => {
    await expect(controller.uploadDocument(null as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('analyzeDocument', () => {
    it('should analyze successfully', async () => {
      const analysis = {
        id: 'doc-1',
        summary: 'ok',
        docType: 'Tech',
        attributes: {},
      };
      service.analyzeDocument.mockResolvedValue(analysis);

      expect(await controller.analyzeDocument('doc-1')).toEqual(analysis);
    });

    it('should throw NotFound when document missing', async () => {
      service.analyzeDocument.mockRejectedValue(new NotFoundException());
      await expect(controller.analyzeDocument('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDocument', () => {
    it('should return full document with analysis', async () => {
      service.getDocument.mockResolvedValue(mockFullDoc);
      const result = await controller.getDocument('doc-1');

      expect(result).toEqual(mockFullDoc);
      expect(result.fileInfo.id).toBe('doc-1');
      expect(result.summary).toBeTruthy();
    });

    it('should return document without analysis (null fields)', async () => {
      const partial = {
        ...mockFullDoc,
        summary: null,
        docType: null,
        metadata: null,
      };
      service.getDocument.mockResolvedValue(partial);

      const result = await controller.getDocument('doc-1');
      expect(result.summary).toBeNull();
      expect(result.docType).toBeNull();
      expect(result.metadata).toBeNull();
    });

    it('should throw NotFound if document not found', async () => {
      service.getDocument.mockRejectedValue(
        new NotFoundException('Document not found'),
      );
      await expect(controller.getDocument('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  it('should handle full flow: upload → analyze → get', async () => {
    service.uploadDocument.mockResolvedValue(mockDoc);
    service.analyzeDocument.mockResolvedValue({
      id: 'doc-1',
      summary: 'done',
      docType: 'tech',
      attributes: {},
    });
    service.getDocument.mockResolvedValue(mockFullDoc);

    const uploaded = await controller.uploadDocument(mockFile);
    await controller.analyzeDocument(uploaded.id);
    const retrieved = await controller.getDocument(uploaded.id);

    expect(retrieved.summary).toBeDefined();
    expect(service.getDocument).toHaveBeenCalledWith('doc-1');
  });
});
