// Statistics module handlers
import * as storage from '../../services/storage.js';
import * as keyboards from '../../ui/keyboards/inline.js';

export async function handleStats(ctx) {
  await ctx.reply('📈 Статистика в розробці', keyboards.getStatisticsKeyboard());
}
