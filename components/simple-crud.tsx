"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { asList, errorMessage } from "@/lib/utils";
import { AdminNav } from "@/components/admin-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface SimpleField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

interface SimpleCrudProps {
  title: string; // "Categories"
  singular: string; // "category"
  endpoint: string; // CONFIG.ENDPOINTS.CATEGORIES
  idKey: string; // "category_id"
  fields: SimpleField[];
}

type Row = Record<string, string | number | null | undefined>;

export function SimpleCrud({
  title,
  singular,
  endpoint,
  idKey,
  fields,
}: SimpleCrudProps) {
  const emptyForm = Object.fromEntries(fields.map((f) => [f.key, ""]));

  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient<unknown>(endpoint, {
        method: "GET",
        requiresAuth: true,
      });
      setRows(asList<Row>(data));
    } catch (err) {
      setError(errorMessage(err, `Failed to fetch ${title.toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, title]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (row: Row) => {
    setEditingId(Number(row[idKey]));
    setForm(
      Object.fromEntries(fields.map((f) => [f.key, String(row[f.key] ?? "")]))
    );
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (editingId !== null) {
        await apiClient(`${endpoint}/${editingId}`, {
          method: "PATCH",
          requiresAuth: true,
          body: JSON.stringify(form),
        });
        setSuccess(`${cap(singular)} updated.`);
      } else {
        await apiClient(endpoint, {
          method: "POST",
          requiresAuth: true,
          body: JSON.stringify(form),
        });
        setSuccess(`${cap(singular)} created.`);
      }
      resetForm();
      await fetchRows();
    } catch (err) {
      setError(errorMessage(err, "Something went wrong."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: Row) => {
    if (!window.confirm(`Delete this ${singular}?`)) return;
    setError("");
    setSuccess("");
    try {
      await apiClient(`${endpoint}/${row[idKey]}`, {
        method: "DELETE",
        requiresAuth: true,
      });
      if (editingId === Number(row[idKey])) resetForm();
      setSuccess(`${cap(singular)} deleted.`);
      await fetchRows();
    } catch (err) {
      setError(errorMessage(err, `Failed to delete ${singular}.`));
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-5xl space-y-6 p-6">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <AdminNav />
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle>
              {editingId !== null ? `Edit ${singular}` : `Add ${singular}`}
            </CardTitle>
            <CardDescription>
              {editingId !== null
                ? `Change the details and save.`
                : `Fill in the details to add a new ${singular}.`}
            </CardDescription>
          </div>
          {editingId !== null && (
            <Button variant="ghost" size="icon" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    required={f.required}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              {editingId !== null && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {editingId !== null ? "Save changes" : `Add ${singular}`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle>All {title.toLowerCase()}</CardTitle>
            <CardDescription>
              {rows.length} {rows.length === 1 ? singular : title.toLowerCase()}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={fetchRows} disabled={loading}>
            <RefreshCw
              className={"mr-2 h-4 w-4 " + (loading ? "animate-spin" : "")}
            />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                {fields.map((f) => (
                  <TableHead key={f.key}>{f.label}</TableHead>
                ))}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={fields.length + 2}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={fields.length + 2}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No {title.toLowerCase()} yet. Add one above.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={String(row[idKey])}>
                    <TableCell>{row[idKey]}</TableCell>
                    {fields.map((f) => (
                      <TableCell key={f.key}>{row[f.key] ?? "-"}</TableCell>
                    ))}
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(row)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(row)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}