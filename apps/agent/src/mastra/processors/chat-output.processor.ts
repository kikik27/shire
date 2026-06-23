import type { Processor, ProcessOutputStepArgs } from "@mastra/core/processors";

import { env } from "../../env";
import { validateOutputText } from "../../runtime/security/output-validation";

export class ChatOutputProcessor implements Processor<"chat-output-processor"> {
  readonly id = "chat-output-processor";
  readonly name = "Chat Output Security Processor";

  async processOutputStep({ text, abort }: ProcessOutputStepArgs) {
    if (!text) {
      return [];
    }

    const result = validateOutputText(text, {
      maxCharacters: env.outputMaxCharacters,
    });

    if (!result.safe) {
      abort("The response was blocked by output security validation.", {
        metadata: { reasonCode: result.reasonCode },
      });
    }

    return [];
  }
}

export const chatOutputProcessor = new ChatOutputProcessor();
