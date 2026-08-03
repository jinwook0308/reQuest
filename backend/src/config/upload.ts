import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { open } from 'node:fs/promises'
import path from 'node:path'

import multer from 'multer'

const uploadDirectory = path.resolve(
  __dirname,
  '../../uploads/wrong-notes',
)

mkdirSync(uploadDirectory, {
  recursive: true,
})

const storage = multer.diskStorage({
  destination: (
    _request,
    _file,
    callback,
  ) => {
    callback(null, uploadDirectory)
  },

  filename: (
    _request,
    file,
    callback,
  ) => {
    const extension =
      file.mimetype === 'image/png'
        ? '.png'
        : '.jpg'

    callback(
      null,
      `${randomUUID()}${extension}`,
    )
  },
})

const imageFileFilter: multer.Options['fileFilter'] = (
  _request,
  file,
  callback,
) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
  ]

  if (
    !allowedMimeTypes.includes(file.mimetype)
  ) {
    callback(
      new Error(
        'JPG 또는 PNG 이미지만 업로드할 수 있습니다.',
      ),
    )

    return
  }

  callback(null, true)
}

export const wrongNoteImageUpload =
  multer({
    storage,
    fileFilter: imageFileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
  })

export async function validateUploadedImage(
  filePath: string,
  mimeType: string,
) {
  const fileHandle = await open(
    filePath,
    'r',
  )

  try {
    const signature = Buffer.alloc(8)

    await fileHandle.read(
      signature,
      0,
      signature.length,
      0,
    )

    if (mimeType === 'image/jpeg') {
      return (
        signature[0] === 0xff &&
        signature[1] === 0xd8 &&
        signature[2] === 0xff
      )
    }

    if (mimeType === 'image/png') {
      const pngSignature = [
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ]

      return pngSignature.every(
        (byte, index) =>
          signature[index] === byte,
      )
    }

    return false
  } finally {
    await fileHandle.close()
  }
}

export function normalizeUploadedFileName(
  fileName: string | null,
) {
  if (!fileName) {
    return fileName
  }

  const decodedFileName = Buffer.from(
    fileName,
    'latin1',
  ).toString('utf8')

  return decodedFileName.includes('\uFFFD')
    ? fileName
    : decodedFileName
}
