// Channel module handlers
import * as storage from '../../services/storage.js';
import * as keyboards from '../../ui/keyboards/inline.js';

export async function handleChannelConnect(ctx) {
  await ctx.reply('Підключення каналу в розробці');
}

export async function handleChannelManage(ctx) {
  await ctx.reply('Управління каналом в розробці');
}
