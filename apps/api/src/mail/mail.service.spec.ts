import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MailTransport } from './mail-transport';
import { MailService } from './mail.service';

let transport: { send: Mock };
let service: MailService;

beforeEach(() => {
  process.env.MAIL_FROM = 'Test <from@test.local>';
  transport = { send: vi.fn().mockResolvedValue(undefined) };
  service = new MailService(transport as unknown as MailTransport);
});

describe('MailService', () => {
  it('sends through the transport with the configured From address', async () => {
    await service.send({ to: 'u@test.local', subject: 'Hi', text: 'body' });
    expect(transport.send).toHaveBeenCalledWith('Test <from@test.local>', {
      to: 'u@test.local',
      subject: 'Hi',
      text: 'body',
    });
  });
});
