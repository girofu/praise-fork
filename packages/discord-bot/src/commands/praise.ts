import { SlashCommandBuilder } from '@discordjs/builders';
import { PraiseModel } from 'api/dist/praise/entities';
import { UserAccountModel } from 'api/dist/useraccount/entities';

import { CommandInteraction, Interaction, Message } from 'discord.js';
import logger from 'jet-logger';
import {
  notActivatedError,
  dmError,
  roleError,
  invalidReceiverError,
  missingReasonError,
  undefinedReceiverWarning,
  roleMentionWarning,
  praiseSuccessDM,
  notActivatedDM,
  praiseSuccess,
} from '../utils/praiseEmbeds';

const praise = async (
  interaction: CommandInteraction,
  interactionMsg: Message
): Promise<void> => {

  const { guild, channel, member } = interaction;

  if (!guild || !member) {
    await interaction.editReply(dmError);
    return;
  }

  const praiseGiverRole = guild.roles.cache.find(
    (r) => r.id === process.env.PRAISE_GIVER_ROLE_ID
  );
  const praiseGiver = await guild.members.fetch(member.user.id);


  if (
    praiseGiverRole &&
    !praiseGiver.roles.cache.find((r) => r.id === praiseGiverRole?.id)
  ) {
    await interaction.editReply({
      embeds: [roleError(praiseGiverRole, praiseGiver)],
    });

    return;
  }

  const ua = {
    id: member.user.id,
    username: member.user.username + '#' + member.user.discriminator,
    profileImageUrl: member.user.avatar,
    platform: 'DISCORD',
  };

  const userAccount = await UserAccountModel.findOneAndUpdate(
    { id: ua.id },
    ua,
    { upsert: true, new: true }
  );

  const receivers = interaction.options.getString('receivers');
  const reason = interaction.options.getString('reason');

  const receiverData = {
    validReceiverIds: receivers?.match(/<@!([0-9]+)>/g),
    undefinedReceivers: receivers?.match(/@([a-z0-9]+)/gi),
    roleMentions: receivers?.match(/<@&([0-9]+)>/g),
  };

  if (
    !receivers ||
    receivers.length === 0 ||
    !receiverData.validReceiverIds ||
    receiverData.validReceiverIds?.length === 0
  ) {
    await interaction.editReply(invalidReceiverError);
    return;
  }

  if (!reason || reason.length === 0) {
    await interaction.editReply(missingReasonError);
    return;
  }

  const User = await UserModel.findOne({
    accounts: userAccount,
  });

  if (!User) {
    const msg = (await interaction.editReply(notActivatedError)) as Message;
    await msg.react('❌');
    return;
  }

  const praised: string[] = [];
  const receiverIds = receiverData.validReceiverIds.map((id) =>
    id.substr(3, id.length - 4)
  );
  const Receivers = (await guild.members.fetch({ user: receiverIds })).map(
    (u) => u
  );

  const guildChannel = await guild.channels.fetch(channel?.id || '');

  for (const receiver of Receivers) {
    const ra = {
      id: receiver.user.id,
      username: receiver.user.username + '#' + receiver.user.discriminator,
      profileImageUrl: receiver.avatar,
      platform: 'DISCORD',
    };
    const receiverAccount = await UserAccountModel.findOneAndUpdate(
      { id: ra.id },
      ra,
      { upsert: true, new: true }
    );

    if (!receiverAccount.user) {
      try {
        await receiver.send({ embeds: [notActivatedDM(interactionMsg.url)] });
      } catch (err) {
        logger.warn(`Can't DM user - ${ra.username} [${ra.id}]`);
      }
    }
    const praiseObj = await PraiseModel.create({
      reason: reason,
      giver: userAccount._id,
      sourceId: `DISCORD:${guild.id}:${interaction.channelId}`,
      sourceName: `DISCORD:${encodeURI(guild.name)}:${encodeURI(
        guildChannel?.name || ''
      )}`,
      receiver: receiverAccount._id,
    });
    if (praiseObj) {
      await receiver.send({ embeds: [praiseSuccessDM(interactionMsg.url)] });
      praised.push(ra.id);
    } else {
      logger.err(
        `Praise not registered for [${ua.id}] -> [${ra.id}] for [${reason}]`
      );
    }
  }


  const msg = (await interaction.editReply(
    praiseSuccess(
      praised.map((id) => `<@!${id}>`),
      reason
    )
  )) as Message;

  if (receiverData.undefinedReceivers) {
    await msg.reply(
      undefinedReceiverWarning(
        receiverData.undefinedReceivers.join(', '),
        ua.id
      )
    );
  }
  if (receiverData.roleMentions) {
    await msg.reply(
      roleMentionWarning(receiverData.roleMentions.join(', '), ua.id)
    );
  }

  return;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('praise')
    .setDescription('Praise a user')
    .addStringOption((option) =>
      option
        .setName('receivers')
        .setDescription(
          'Mention the users you would like to send this praice to'
        )
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for this Praise')
        .setRequired(true)
    ),

  async execute(interaction: Interaction): Promise<void> {
    if (interaction.isCommand()) {
      if (interaction.commandName === 'praise') {
        const msg = await interaction.deferReply();
        if (msg !== undefined) {
          await praise(interaction, msg);
        }
      }
    }
  },
};
