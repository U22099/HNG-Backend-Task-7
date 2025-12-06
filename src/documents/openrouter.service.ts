import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface LLMAnalysisResult {
  summary: string;
  docType: string;
  attributes: Record<string, any>;
}

@Injectable()
export class OpenRouterService {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';
  private model: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY', '');
    this.model = this.configService.get<string>(
      'OPENROUTER_MODEL',
      'gpt-3.5-turbo',
    );
  }

  async analyzeDocument(text: string): Promise<LLMAnalysisResult> {
    try {
      const prompt = this.buildAnalysisPrompt(text);

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Document Analyzer',
          },
        },
      );

      const content = response.data.choices[0].message.content;
      return this.parseAnalysisResponse(content);
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to analyze document with LLM: ${error.message}`,
      );
    }
  }

  private buildAnalysisPrompt(text: string): string {
    const truncatedText = text.substring(0, 8000);

    return `Analyze the following document and provide:
      1. A concise summary (2-3 sentences)
      2. Document type (invoice, CV, report, letter, contract, email, or other)
      3. Extracted metadata (date, sender, recipient, total amount if applicable, etc.)

      Document text:
      ${truncatedText}

      Please respond in the following JSON format:
      {
        "summary": "A concise summary of the document",
        "docType": "document type here",
        "attributes": {
          "date": "extracted date if available",
          "sender": "sender/author if available",
          "recipient": "recipient if available",
          "totalAmount": "total amount if available",
          "subject": "subject/title if available"
        }
      }

      Respond ONLY with valid JSON.`;
  }

  private parseAnalysisResponse(content: string): LLMAnalysisResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      console.log(parsed);

      return {
        summary: parsed.summary || 'No summary available',
        docType: parsed.docType || 'unknown',
        attributes: parsed.attributes || {},
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to parse LLM response: ${error.message}`,
      );
    }
  }
}
