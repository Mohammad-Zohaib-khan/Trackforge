import { useState } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react';
import type { CategoryDto, TransactionType } from '@trackforge/shared';
import { Page, Section } from '../../components/layout/Page';
import { Button, IconButton } from '../../components/ui/Button';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Skeleton } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { useCategories, useDeleteCategory, useUpdateCategory } from '../../lib/queries';
import { ApiError, errorMessage } from '../../lib/api';
import { CategoryFormDialog } from './CategoryFormDialog';

export function CategoriesPage() {
  const [showArchived, setShowArchived] = useState(false);
  const categories = useCategories({ includeArchived: true });
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { notify } = useToast();
  const [form, setForm] = useState<{ open: boolean; editing: CategoryDto | null; type: TransactionType; session: number }>({ open: false, editing: null, type: 'expense', session: 0 });
  const openForm = (editing: CategoryDto | null, type: TransactionType) => setForm((f) => ({ open: true, editing, type, session: f.session + 1 }));
  const [deleting, setDeleting] = useState<CategoryDto | null>(null);

  const all = categories.data ?? [];
  const archivedCount = all.filter((c) => c.archived).length;
  const visible = all.filter((c) => showArchived || !c.archived);

  const toggleArchive = async (c: CategoryDto) => {
    try {
      await updateCategory.mutateAsync({ id: c.id, input: { archived: !c.archived } });
      notify(c.archived ? `${c.name} restored` : `${c.name} archived. Past transactions keep it.`);
    } catch (err) {
      notify(errorMessage(err), { tone: 'error' });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCategory.mutateAsync(deleting.id);
      notify(`${deleting.name} deleted`);
      setDeleting(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CATEGORY_IN_USE') {
        const target = deleting;
        setDeleting(null);
        notify('This category has history, so it was not deleted.', {
          tone: 'error',
          action: target.archived ? undefined : { label: 'Archive instead', onClick: () => void toggleArchive(target) },
        });
      } else {
        notify(errorMessage(err), { tone: 'error' });
      }
    }
  };

  const renderList = (type: TransactionType) => {
    const items = visible.filter((c) => c.type === type);
    return (
      <Section
        title={type === 'income' ? 'Income' : 'Expenses'}
        description={`${items.filter((c) => !c.archived).length} active`}
        actions={
          <Button variant="secondary" size="sm" icon={<Plus aria-hidden className="size-4" />} onClick={() => openForm(null, type)}>
            New {type === 'income' ? 'income' : 'expense'} category
          </Button>
        }
      >
        {categories.isPending ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : items.length === 0 ? (
          <p className="text-[14px] text-muted">No {type} categories yet.</p>
        ) : (
          <ul className="divide-y divide-line/70 border-y border-line/70">
            {items.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <CategoryIcon icon={c.icon} color={c.color} />
                <span className={c.archived ? 'flex-1 truncate text-[14px] text-faint' : 'flex-1 truncate text-[14px] text-ink'}>
                  {c.name}
                  {c.archived && <span className="ml-2 rounded-sm border border-line px-1.5 py-0.5 text-[11px] text-faint">Archived</span>}
                </span>
                <IconButton label={`Edit ${c.name}`} onClick={() => openForm(c, c.type)}>
                  <Pencil className="size-4" aria-hidden />
                </IconButton>
                <IconButton label={c.archived ? `Restore ${c.name}` : `Archive ${c.name}`} onClick={() => void toggleArchive(c)}>
                  {c.archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
                </IconButton>
                <IconButton label={`Delete ${c.name}`} tone="danger" onClick={() => setDeleting(c)}>
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Section>
    );
  };

  return (
    <Page
      title="Categories"
      description="Group income and spending your way. Archive a category to hide it from new entries while keeping its history."
      actions={
        archivedCount > 0 ? (
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-sheet/70 px-3 py-2 text-[13px] text-muted backdrop-blur">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[var(--color-mint)]" />
            Show archived ({archivedCount})
          </label>
        ) : undefined
      }
    >
      {categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      ) : (
        <div className="grid gap-12 lg:grid-cols-2">
          {renderList('expense')}
          {renderList('income')}
        </div>
      )}

      <CategoryFormDialog
        key={form.session}
        open={form.open}
        editing={form.editing}
        type={form.type}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'category'}?`}
        body="Categories that are used by transactions or budgets cannot be deleted, so your history stays accurate. Archive those instead."
        confirmLabel="Delete category"
        loading={deleteCategory.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </Page>
  );
}
