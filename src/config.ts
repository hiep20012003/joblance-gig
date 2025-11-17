import path from 'path';

import cloudinary from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(
    process.cwd(),
    `.env.${process.env.NODE_ENV || 'development'}`
  ),
});

class Config {
  // Application
  public NODE_ENV: string = process.env.NODE_ENV || 'development';
  public PORT: number = parseInt(process.env.PORT || '4003', 10);

  public API_GATEWAY_URL: string = process.env.API_GATEWAY_URL || 'http://localhost:4000';
  // Database
  public DATABASE_URL: string =
    process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/joblance-users';

  // Messaging / RabbitMQ / Redis
  public RABBITMQ_URL: string =
    process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  public REDIS_URL: string =
    process.env.REDIS_URL || 'redis://localhost:6379';

  // Gateway secret for internal JWT
  public GATEWAY_SECRET_KEY: string = process.env.GATEWAY_SECRET_KEY || '';

  // APM & Elasticsearch

  public ELASTIC_SEARCH_URL: string = process.env.ELASTIC_SEARCH_URL || '';
  public ENABLE_APM: boolean = process.env.ENABLE_APM === '1';
  public ELASTIC_APM_SERVER_URL: string = process.env.ELASTIC_APM_SERVER_URL || '';
  public ELASTIC_APM_SECRET_TOKEN: string = process.env.ELASTIC_APM_SECRET_TOKEN || '';

  // Cloudinary
  public CLOUDINARY_CLOUD_NAME: string = process.env.CLOUDINARY_CLOUD_NAME || '';
  public CLOUDINARY_API_KEY: string = process.env.CLOUDINARY_API_KEY || '';
  public CLOUDINARY_API_SECRET: string = process.env.CLOUDINARY_API_SECRET || '';

  // Gig placeholder
  public GIG_PLACEHOLDER_IMAGE_URL: string = process.env.GIG_PLACEHOLDER_IMAGE_URL || '';

  public cloudinaryConfig(): void {
    cloudinary.v2.config({
      cloud_name: this.CLOUDINARY_CLOUD_NAME,
      api_key: this.CLOUDINARY_API_KEY,
      api_secret: this.CLOUDINARY_API_SECRET,
      secure: true
    });
  }
}

export const config = new Config();

