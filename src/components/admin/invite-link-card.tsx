'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  generateMemberInviteAction,
  generateOwnerInviteAction,
  regenerateInviteAction,
} from '@/lib/family/actions';

type Mode = 'owner' | 'member';

interface ActiveInvite {
  id: string;
  url: string;
  expiresAt: string;
}

interface Props {
  familyId: string;
  mode: Mode;
  existing?: ActiveInvite | null;
  /** test scope prefix, e.g. `admin-family-<slug>` or `settings-family-<slug>` */
  testIdPrefix: string;
}

/**
 * Renders one row of "generate / regenerate / copy" controls for an invite link.
 * Used by both the admin panel (owner invites) and the family settings page
 * (member invites). Keeps the dispatch logic in one place so the two callers
 * stay symmetrical.
 */
export function InviteLinkCard({ familyId, mode, existing, testIdPrefix }: Props) {
  const t = useTranslations('admin.invite');
  const tFam = useTranslations('admin.families');
  const format = useFormatter();
  const [invite, setInvite] = useState<ActiveInvite | null>(existing ?? null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result =
        mode === 'owner'
          ? await generateOwnerInviteAction({ familyId })
          : await generateMemberInviteAction({ familyId });
      if (result.ok) {
        setInvite({ id: '', url: result.data.url, expiresAt: result.data.expiresAt });
      } else {
        toast.error(result.error);
      }
    });
  }

  function regenerate() {
    if (!invite?.id) {
      generate();
      return;
    }
    startTransition(async () => {
      const result = await regenerateInviteAction({ inviteId: invite.id });
      if (result.ok) {
        setInvite({ id: '', url: result.data.url, expiresAt: result.data.expiresAt });
      } else {
        toast.error(result.error);
      }
    });
  }

  async function copy() {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.url);
    toast.success(t('copied'));
  }

  if (!invite) {
    return (
      <Button
        type="button"
        onClick={generate}
        disabled={isPending}
        variant="outline"
        size="sm"
        data-testid={`${testIdPrefix}-generate-${mode}-invite-button`}
      >
        {mode === 'owner' ? tFam('generateOwnerInvite') : t('copy')}
      </Button>
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border p-3 text-sm">
      <label className="text-muted-foreground text-xs tracking-wide uppercase">
        {t('linkLabel')}
      </label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={invite.url}
          data-testid={`${testIdPrefix}-${mode}-invite-url-input`}
        />
        <Button
          type="button"
          onClick={copy}
          size="sm"
          data-testid={`${testIdPrefix}-${mode}-invite-copy-button`}
        >
          {t('copy')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {t('expiresAt', {
          when: format.dateTime(new Date(invite.expiresAt), {
            dateStyle: 'short',
            timeStyle: 'short',
          }),
        })}
      </p>
      <Button
        type="button"
        onClick={regenerate}
        disabled={isPending}
        variant="ghost"
        size="sm"
        data-testid={`${testIdPrefix}-${mode}-invite-regenerate-button`}
      >
        {tFam('regenerate')}
      </Button>
    </div>
  );
}
