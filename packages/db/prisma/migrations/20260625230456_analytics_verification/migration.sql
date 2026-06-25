-- AlterTable
ALTER TABLE "SiteProfile" ADD COLUMN     "bingSiteVerification" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "customVerificationTags" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "facebookDomainVerification" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ga4MeasurementId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "googleSiteVerification" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gtmContainerId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pinterestVerification" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "yandexVerification" TEXT NOT NULL DEFAULT '';
