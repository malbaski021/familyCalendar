'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { PencilIcon, TrashIcon, CheckIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  addChildAction,
  removeChildAction,
  renameChildAction,
} from '@/lib/family/children-actions';

interface Child {
  id: string;
  name: string;
}

interface Props {
  initial: Child[];
  /** Prefix for testids on every row + control. */
  testIdPrefix: string;
}

export function ChildrenManager({ initial, testIdPrefix }: Props) {
  const t = useTranslations('children');
  const [children, setChildren] = useState<Child[]>(initial);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isPending, startTransition] = useTransition();

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await addChildAction({ name });
      if (result.ok) {
        setChildren((prev) => [...prev, result.data]);
        setDraft('');
      } else {
        toast.error(result.error);
      }
    });
  }

  function startEdit(child: Child) {
    setEditingId(child.id);
    setEditingValue(child.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingValue('');
  }

  function commitRename(child: Child) {
    const name = editingValue.trim();
    if (!name || name === child.name) {
      cancelEdit();
      return;
    }
    startTransition(async () => {
      const result = await renameChildAction({ id: child.id, name });
      if (result.ok) {
        setChildren((prev) =>
          prev.map((c) => (c.id === child.id ? { ...c, name: result.data.name } : c)),
        );
        cancelEdit();
      } else {
        toast.error(result.error);
      }
    });
  }

  function onRemove(child: Child) {
    startTransition(async () => {
      const result = await removeChildAction({ id: child.id });
      if (result.ok) {
        setChildren((prev) => prev.filter((c) => c.id !== child.id));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={onAdd} className="flex gap-2" data-testid={`${testIdPrefix}-add-form`}>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('placeholder')}
          autoComplete="off"
          maxLength={60}
          data-testid={`${testIdPrefix}-add-name-input`}
        />
        <Button
          type="submit"
          disabled={isPending || draft.trim().length < 1}
          data-testid={`${testIdPrefix}-add-submit-button`}
        >
          {t('add')}
        </Button>
      </form>

      {children.length === 0 ? (
        <p className="text-muted-foreground text-sm" data-testid={`${testIdPrefix}-empty`}>
          {t('empty')}
        </p>
      ) : (
        <ul className="grid gap-2">
          {children.map((child) => (
            <li
              key={child.id}
              className="flex items-center justify-between gap-2 rounded-lg border p-3"
              data-testid={`${testIdPrefix}-row-${child.id}`}
            >
              {editingId === child.id ? (
                <>
                  <Input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    maxLength={60}
                    data-testid={`${testIdPrefix}-row-${child.id}-rename-input`}
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => commitRename(child)}
                      disabled={isPending}
                      aria-label={t('save')}
                      data-testid={`${testIdPrefix}-row-${child.id}-rename-save-button`}
                    >
                      <CheckIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={cancelEdit}
                      disabled={isPending}
                      aria-label={t('cancel')}
                      data-testid={`${testIdPrefix}-row-${child.id}-rename-cancel-button`}
                    >
                      <XIcon />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium">{child.name}</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEdit(child)}
                      aria-label={t('rename')}
                      data-testid={`${testIdPrefix}-row-${child.id}-edit-button`}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemove(child)}
                      disabled={isPending}
                      aria-label={t('remove')}
                      data-testid={`${testIdPrefix}-row-${child.id}-remove-button`}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
