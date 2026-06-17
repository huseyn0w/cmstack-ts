import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  type Media,
  type MediaList,
  type MediaListQuery,
  type UpdateMediaInput,
  mediaListQuerySchema,
  parseEnv,
  updateMediaSchema,
} from '@typress/config';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MediaService } from './media.service';

const MAX_BYTES = parseEnv().MEDIA_MAX_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME = new RegExp(
  `^(${ALLOWED_MEDIA_MIME_TYPES.map((t) => t.replace('/', '\\/')).join('|')})$`,
);

@Controller('media')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Media'))
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_BYTES }),
          new FileTypeValidator({ fileType: ALLOWED_MIME }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Media> {
    return this.media.upload(file, user.id);
  }

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Media'))
  list(
    @Query(new ZodValidationPipe(mediaListQuerySchema)) query: MediaListQuery,
  ): Promise<MediaList> {
    return this.media.list(query);
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Media'))
  findOne(@Param('id') id: string): Promise<Media> {
    return this.media.findById(id);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'Media'))
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMediaSchema)) body: UpdateMediaInput,
  ): Promise<Media> {
    return this.media.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckPolicies((ability) => ability.can('delete', 'Media'))
  async remove(@Param('id') id: string): Promise<void> {
    await this.media.remove(id);
  }
}
