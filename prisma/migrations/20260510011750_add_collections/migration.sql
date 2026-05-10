-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_items" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "place_name" TEXT NOT NULL,
    "place_address" TEXT,
    "place_photo_url" TEXT,
    "place_rating" DECIMAL(3,1),
    "note" VARCHAR(200),
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_shares" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "shared_with_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collections_user_id_idx" ON "collections"("user_id");

-- CreateIndex
CREATE INDEX "collection_items_collection_id_idx" ON "collection_items"("collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_items_collection_id_place_id_key" ON "collection_items"("collection_id", "place_id");

-- CreateIndex
CREATE INDEX "collection_shares_shared_with_id_idx" ON "collection_shares"("shared_with_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_shares_collection_id_shared_with_id_key" ON "collection_shares"("collection_id", "shared_with_id");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_shares" ADD CONSTRAINT "collection_shares_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_shares" ADD CONSTRAINT "collection_shares_shared_with_id_fkey" FOREIGN KEY ("shared_with_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
