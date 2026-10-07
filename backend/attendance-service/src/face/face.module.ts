import { Module } from '@nestjs/common';
import { FACE_AI_PROVIDER } from './interfaces/face-ai-provider.interface';
import { HttpFaceAiProvider } from './providers/http-face-ai.provider';
import { MockFaceAiProvider } from './providers/mock-face-ai.provider';

@Module({
  providers: [
    MockFaceAiProvider,
    HttpFaceAiProvider,
    {
      provide: FACE_AI_PROVIDER,
      useExisting: HttpFaceAiProvider,
    },
  ],
  exports: [FACE_AI_PROVIDER, MockFaceAiProvider, HttpFaceAiProvider],
})
export class FaceModule {}
