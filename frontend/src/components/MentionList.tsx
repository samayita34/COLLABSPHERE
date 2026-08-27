import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Member } from '../services/projectApi';

interface MentionListProps {
  items: Member[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.userId || item.initials, label: item.name });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length) {
    return null;
  }

  return (
    <div className="bg-background border border-border rounded-md shadow-md overflow-hidden p-1 min-w-[200px]">
      {props.items.map((item, index) => (
        <button
          className={`flex items-center w-full px-2 py-1.5 text-sm text-left rounded-sm ${index === selectedIndex ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
          key={index}
          onClick={() => selectItem(index)}
        >
          <div className="w-6 h-6 mr-2 flex items-center justify-center bg-primary text-primary-foreground text-xs rounded-full">
            {item.initials}
          </div>
          {item.name}
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = 'MentionList';
