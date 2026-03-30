'use client';

interface NexeraCoachAvatarProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  faded?: boolean;
}

const sizeMap = {
  small: 'h-8 w-8 text-sm',
  medium: 'h-10 w-10 text-base',
  large: 'h-12 w-12 text-lg',
  xlarge: 'h-16 w-16 text-xl',
};

export function NexeraCoachAvatar({
  size = 'medium',
  faded,
}: NexeraCoachAvatarProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 font-bold text-white ${
        sizeMap[size]
      } ${faded ? 'opacity-40' : ''}`}
    >
      N
    </div>
  );
}
