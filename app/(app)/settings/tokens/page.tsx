'use client'

import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  Check,
  Copy,
  Key,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PersonalAccessToken } from '@/db/schema/personal-access-tokens'

type TokenListItem = Omit<PersonalAccessToken, 'tokenHash'>

export default function TokensPage() {
  const [tokens, setTokens] = useState<TokenListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchTokens = useCallback(async () => {
    try {
      const response = await fetch('/api/tokens')
      if (response.ok) {
        const data = await response.json()
        setTokens(data.tokens)
      }
    } catch (error) {
      console.error('Failed to fetch tokens:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Token name is required')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!response.ok) {
        throw new Error('Failed to create token')
      }

      const data = await response.json()
      setNewToken(data.token)
      setTokens((prev) => [data.tokenInfo, ...prev])
      setName('')
    } catch (_error) {
      toast.error('Failed to create token')
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!newToken) {
      return
    }
    await navigator.clipboard.writeText(newToken)
    setCopied(true)
    toast.success('Token copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCloseNewToken = () => {
    setNewToken(null)
    setCreateDialogOpen(false)
    setCreating(false)
  }

  const handleRevoke = async (tokenId: string) => {
    try {
      const response = await fetch(`/api/tokens/${tokenId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to revoke token')
      }

      setTokens((prev) => prev.filter((t) => t.id !== tokenId))
      toast.success('Token revoked')
    } catch (_error) {
      toast.error('Failed to revoke token')
    }
  }

  return (
    <div className="container max-w-4xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Access Tokens</h1>
          <p className="text-muted-foreground">
            Manage personal access tokens for the browser extension
          </p>
        </div>

        <Dialog onOpenChange={setCreateDialogOpen} open={createDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setNewToken(null)}>
              <Plus className="mr-2 h-4 w-4" />
              New Token
            </Button>
          </DialogTrigger>
          <DialogContent>
            {newToken ? (
              <>
                <DialogHeader>
                  <DialogTitle>Token Created</DialogTitle>
                  <DialogDescription>
                    Copy this token now. You won&apos;t be able to see it again.
                  </DialogDescription>
                </DialogHeader>

                <Alert
                  className="border-amber-500/50 bg-amber-500/10"
                  variant="default"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertTitle className="text-amber-600">Important</AlertTitle>
                  <AlertDescription className="text-amber-600/80">
                    This token will only be shown once. Make sure to copy it now
                    and store it safely.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Your token</Label>
                  <div className="flex gap-2">
                    <Input
                      className="font-mono text-sm"
                      readOnly
                      value={newToken}
                    />
                    <Button onClick={handleCopy} variant="outline">
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <DialogFooter>
                  <Button onClick={handleCloseNewToken}>Done</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create Access Token</DialogTitle>
                  <DialogDescription>
                    Create a new personal access token to use with the browser
                    extension.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Token Name</Label>
                    <Input
                      id="name"
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Chrome Extension"
                      value={name}
                    />
                    <p className="text-muted-foreground text-xs">
                      A friendly name to identify this token
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    onClick={() => setCreateDialogOpen(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button disabled={creating} onClick={handleCreate}>
                    {creating && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Token
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About Access Tokens</CardTitle>
          <CardDescription>
            Access tokens allow the browser extension to upload assets to your
            account without requiring you to sign in. Treat them like passwords
            and keep them secure.
          </CardDescription>
        </CardHeader>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && tokens.length === 0 && (
        <Empty className="py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Key className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>No access tokens</EmptyTitle>
            <EmptyDescription>
              Create a token to use with the browser extension
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Token
            </Button>
          </EmptyContent>
        </Empty>
      )}
      {!loading && tokens.length > 0 && (
        <div className="space-y-3">
          {tokens.map((token) => (
            <Card key={token.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Key className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{token.name}</p>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {token.tokenPrefix}...
                        </code>
                        <span>•</span>
                        <span>
                          Created{' '}
                          {formatDistanceToNow(new Date(token.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                        {token.lastUsedAt && (
                          <>
                            <span>•</span>
                            <span>
                              Last used{' '}
                              {formatDistanceToNow(new Date(token.lastUsedAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="text-destructive"
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke Token</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will immediately revoke this token. Any services
                          using it will no longer be able to authenticate.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90"
                          onClick={() => handleRevoke(token.id)}
                        >
                          Revoke
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
