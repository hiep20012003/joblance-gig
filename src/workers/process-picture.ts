import sharp from 'sharp';

export default async function processPicture(buffer: Buffer): Promise<Buffer> {
    const coverBuffer = await sharp(buffer)
        .resize(1280, 720, {
            fit: 'cover',
            position: 'center'
        })
        .jpeg({ quality: 85 })
        .toBuffer();

    return coverBuffer;
}
