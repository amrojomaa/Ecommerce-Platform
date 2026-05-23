import React from 'react';
import { DEFAULT_PROFILE_IMAGE, resolveProfileImageUrl } from '../utils/helpers';
import '../styles/components/TicketUserAvatar.css';

const TicketUserAvatar = ({ user, size = 40, className = '' }) => {
  const displayName = user
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'User'
    : 'User';
  const initials = user
    ? `${(user.first_name || '').charAt(0)}${(user.last_name || '').charAt(0)}`.toUpperCase() ||
      (user.email || '?').charAt(0).toUpperCase()
    : '?';

  const src = resolveProfileImageUrl(user?.profile_image);
  const hasImage = Boolean(user?.profile_image);

  return (
    <span
      className={`ticket-user-avatar ${hasImage ? 'has-image' : 'has-initials'} ${className}`.trim()}
      style={{ width: size, height: size, minWidth: size }}
      title={displayName}
    >
      {hasImage ? (
        <img
          src={src}
          alt={displayName}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            if (e.target.src !== DEFAULT_PROFILE_IMAGE) {
              e.target.src = DEFAULT_PROFILE_IMAGE;
            }
          }}
        />
      ) : (
        <span className="ticket-user-avatar-initials" aria-hidden>
          {initials}
        </span>
      )}
    </span>
  );
};

export default TicketUserAvatar;
