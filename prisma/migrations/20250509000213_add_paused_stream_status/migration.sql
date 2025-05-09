-- AlterEnum
ALTER TYPE "StreamStatus" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "_RewardRecipients" ADD CONSTRAINT "_RewardRecipients_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_RewardRecipients_AB_unique";

-- AlterTable
ALTER TABLE "_StreamViewers" ADD CONSTRAINT "_StreamViewers_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_StreamViewers_AB_unique";

-- AlterTable
ALTER TABLE "_UserConversations" ADD CONSTRAINT "_UserConversations_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_UserConversations_AB_unique";
