'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { requestPasswordResetAction } from '@/lib/auth/actions';
import { resetPasswordRequestSchema, type ResetPasswordRequestInput } from '@/lib/auth/schemas';

export function ResetPasswordRequestForm() {
  const t = useTranslations('auth');
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ResetPasswordRequestInput>({
    resolver: zodResolver(resetPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  function onSubmit(values: ResetPasswordRequestInput) {
    startTransition(async () => {
      const origin = window.location.origin;
      const result = await requestPasswordResetAction(values, origin);
      if (result.ok) {
        setSubmitted(true);
        toast.success(t('forgotPassword.success'));
      } else {
        toast.error(result.error);
      }
    });
  }

  if (submitted) {
    return (
      <p role="status" className="text-sm">
        {t('forgotPassword.success')}
      </p>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
        </Button>
      </form>
    </Form>
  );
}
