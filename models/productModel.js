import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    category: {
      type: mongoose.ObjectId,
      ref: "Category",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    photo: {
      data: Buffer,
      contentType: String,
    },
    shipping: {
      type: Boolean,
    },
  },
  { timestamps: true }
);

// Snodgrass Eliot Peter, A0269684H
// Indexes to support search (regex on name/description), filter (price range, category),
// and paginated listing (sort by createdAt) without full-collection scans under load.
productSchema.index({ name: 1 });
productSchema.index({ description: 1 });
productSchema.index({ price: 1 });
productSchema.index({ category: 1 });
productSchema.index({ createdAt: -1 });

export default mongoose.model("Products", productSchema);