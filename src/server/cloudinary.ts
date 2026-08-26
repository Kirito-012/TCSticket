import 'server-only'

import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export type UploadedImage = {
  url: string
  publicId: string
  width: number
  height: number
}

/** Uploads one image file to Cloudinary under the ticket-comments folder. */
export async function uploadCommentImage(file: File): Promise<UploadedImage> {
  const buffer = Buffer.from(await file.arrayBuffer())

  const result = await new Promise<{
    secure_url: string
    public_id: string
    width: number
    height: number
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'tcs-ticket/comments', resource_type: 'image' },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'))
        resolve(result)
      },
    )
    stream.end(buffer)
  })

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  }
}

export async function deleteCommentImage(publicId: string) {
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
}
