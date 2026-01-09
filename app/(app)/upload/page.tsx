'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UploadDropzone } from '@/components/upload-dropzone'

export default function UploadPage() {
  const router = useRouter()

  function handleUploadComplete(assetIds: string[]) {
    toast.success(
      `${assetIds.length} asset${assetIds.length > 1 ? 's' : ''} uploaded successfully`,
    )
    router.push('/assets')
  }

  return (
    <div className="container max-w-4xl space-y-8 py-8">
      <div className="space-y-2">
        <h1 className="font-bold text-3xl tracking-tight">Upload Assets</h1>
        <p className="text-muted-foreground">
          Upload images and videos to your creative ads library. Select the
          source platform for each file to keep your assets organized.
        </p>
      </div>

      <UploadDropzone onUploadComplete={handleUploadComplete} />
    </div>
  )
}
