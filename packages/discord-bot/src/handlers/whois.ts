import { getUserAccount } from '../utils/getUserAccount';
import { renderMessage } from '../utils/renderMessage';
import { apiClient } from '../utils/api';
import { CommandHandler } from '../interfaces/CommandHandler';
import {
  PraisePaginatedResponseDto,
  UserWithStatsDto,
} from '../utils/api-schema';
import { queryOpenAi } from '../utils/queryOpenAi';
import { EmbedBuilder } from '@discordjs/builders';
import { logger } from '../utils/logger';
import { APIEmbedField } from 'discord.js';
import Keyv from 'keyv';

const CACHE_TTL = 60 * 1000 * 60 * 24 * 7; // 7 days

// Create a new Keyv instance for caching responses from OpenAI
const keyv = new Keyv();

/**
 * Execute command /whoami
 * Gives the user information about their account and activation status
 *
 */
export const whoisHandler: CommandHandler = async (
  client,
  interaction,
  host
): Promise<void> => {
  const { member, guild } = interaction;
  if (!guild || !member) {
    await interaction.editReply(await renderMessage('DM_ERROR'));
    return;
  }

  try {
    const discordUser = interaction.options.getUser('member', true);

    // Check if we have a cached user embed
    const cachedUserEmbed = await keyv.get(`${host} ${discordUser.id}`);
    if (cachedUserEmbed) {
      await interaction.editReply({ embeds: [cachedUserEmbed] });
      return;
    }

    const userAccount = await getUserAccount(discordUser, host);

    if (!process.env.OPENAI_KEY) {
      await interaction.editReply("This feature isn't available yet.");
      return;
    }

    if (!userAccount) {
      await interaction.editReply('No data available on that user so far...');
      return;
    }

    const response = await apiClient.get<PraisePaginatedResponseDto>(
      `/praise?limit=100&page=1&receiver=${userAccount._id}&sortType=desc&sortColumn=score`,
      {
        headers: { host },
      }
    );

    const praise = [...response.data.docs];

    praise.sort((a, b) => b.score - a.score);

    const topPraiseCsv =
      'score, reason\n' +
      praise.map((item) => `${item.score}, ${item.reason}`).join('\n');

    const summaryPrompt = `Below is a table of praise items describing contributions made by community member ${userAccount.name}. Summarize, what kind of work does ${userAccount.name} do for the community? The first column is a score representing the impact of the contribution, the second column describes the contribution. The higher impact score a contribution has the more it impacts your description of ${userAccount.name}. Max 700 characters.`;
    const labelPrompt = `Below is a list of contributions made by community member ${userAccount.name}. The first column of the list is a score representing the impact of the contribution, the second column describes the contribution. I want you to create a comma separated list of labels that describe the most impactful work ${userAccount.name} does for the community. The higher impact score a contribution has the more it impacts your description. A label can consist of at max two words. 7 labels please.`;

    const [summary, labels, user] = await Promise.all([
      queryOpenAi(topPraiseCsv, summaryPrompt, process.env.OPENAI_KEY),
      queryOpenAi(topPraiseCsv, labelPrompt, process.env.OPENAI_KEY),
      userAccount.user
        ? apiClient
            .get<UserWithStatsDto>(`/users/${userAccount.user._id}`, {
              headers: { host },
            })
            .then((res) => res.data)
        : Promise.resolve(null),
    ]);

    const fields: APIEmbedField[] = [{ name: 'Labels', value: labels }];

    fields.push({
      name: 'Joined',
      value: new Date(userAccount.createdAt).toDateString(),
    });

    if (user) {
      user.receivedTotalScore &&
        fields.push({
          name: 'Received praise total score',
          value: user.receivedTotalScore.toString(),
        });

      user.givenTotalScore &&
        fields.push({
          name: 'Given praise total score',
          value: user.givenTotalScore.toString(),
        });
    }

    const embed = new EmbedBuilder()
      .setTitle(userAccount.name)
      .setDescription(summary)
      .setThumbnail(
        `https://cdn.discordapp.com/avatars/${discordUser.id}/${
          discordUser?.avatar || ''
        }`
      )
      .setFooter({ text: '🤖 This is an AI generated description.' })
      .addFields(fields);

    // Cache the embed for a week
    await keyv.set(`${host} ${discordUser.id}`, embed, CACHE_TTL);

    // Send the embed
    await interaction.editReply({
      embeds: [embed],
    });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger.error(`(whois) ${(err as any).message as string}`);
    throw err;
  }
};
