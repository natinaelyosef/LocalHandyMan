import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const ServiceCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "" },
    parent: { type: Schema.Types.ObjectId, ref: "ServiceCategory", default: null, index: true },
    active: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type ServiceCategoryDoc = InferSchemaType<typeof ServiceCategorySchema>;
export const ServiceCategory: Model<ServiceCategoryDoc> =
  models.ServiceCategory || model("ServiceCategory", ServiceCategorySchema);
