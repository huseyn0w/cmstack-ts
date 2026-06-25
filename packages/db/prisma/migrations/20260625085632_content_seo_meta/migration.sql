-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "noindex" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "noindex" BOOLEAN NOT NULL DEFAULT false;
