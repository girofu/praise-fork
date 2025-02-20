import { faUserCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';
import { UserWithStatsDto } from '@/model/user/dto/user-with-stats.dto';
import { UserAccount } from '@/model/useraccount/dto/user-account.dto';
import { useRecoilValue } from 'recoil';
import { SingleUser } from '../../model/user/users';
import { User } from '../../model/user/dto/user.dto';

const discordAvatarUrl = (account: UserAccount): string => {
  return `https://cdn.discordapp.com/avatars/${account.accountId}/${account.avatarId}.webp?size=128`;
};

interface UserAvatarProps {
  user?: UserWithStatsDto;
  userId?: string | undefined;
  userAccount?: UserAccount;
  usePseudonym?: boolean;
}
const WrappedUserAvatar = ({
  user,
  userId,
  userAccount,
  usePseudonym = false,
}: UserAvatarProps): JSX.Element => {
  const userFromId = useRecoilValue(SingleUser(userId));

  // Merge user and userFromId
  user = user || userFromId;

  // If we have a userAccount, but no user, we can use the user from the userAccount
  if (
    !user &&
    userAccount &&
    userAccount.user &&
    typeof userAccount.user === 'object'
  ) {
    user = userAccount.user as User;
  }

  const [imageLoadError, setImageLoadError] = React.useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = React.useState<boolean>(false);
  if (imageLoadError || usePseudonym)
    return <FontAwesomeIcon icon={faUserCircle} size="1x" />;

  let url;
  if (user) {
    if (Array.isArray(user.accounts) && user.accounts.length > 0) {
      for (const account of user.accounts) {
        // Prefer DISCORD over others
        if (account.avatarId && account.platform === 'DISCORD') {
          url = discordAvatarUrl(account);
          break;
        }
      }
    }
  }
  if (userAccount) {
    if (userAccount.avatarId && userAccount.platform === 'DISCORD') {
      url = discordAvatarUrl(userAccount);
    }
  }
  return url ? (
    <>
      {!imageLoaded && <FontAwesomeIcon icon={faUserCircle} size="1x" />}
      <img
        src={url}
        onError={(): void => setImageLoadError(true)}
        onLoad={(): void => setImageLoaded(true)}
        alt="avatar"
        className="object-contain h-[1em] rounded-full"
        style={!imageLoaded ? { display: 'none' } : {}}
      />
    </>
  ) : (
    <FontAwesomeIcon icon={faUserCircle} size="1x" />
  );
};

export const UserAvatar = React.memo(WrappedUserAvatar);
