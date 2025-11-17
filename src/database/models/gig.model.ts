import {Model, Schema, model, Document} from 'mongoose';
import {IGigDocument, IRequirementQuestion} from '@hiep20012003/joblance-shared';
import {v4 as uuidv4} from 'uuid';

const requirementQuestionSchema = new Schema<IRequirementQuestion>(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
            required: true,
        },
        question: {type: String, required: true},
        hasFile: {type: Boolean, default: false},
        required: {type: Boolean, required: true},
    }
);

const gigSchema: Schema<IGigDocument> = new Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
            required: true,
        },

        sellerId: {type: String, required: true, index: true},
        username: {type: String, required: true},
        email: {type: String, required: true},
        profilePicture: {type: String, required: true},

        title: {type: String, required: true},
        basicTitle: {type: String, required: true},
        description: {type: String, required: true},
        basicDescription: {type: String, required: true},
        categories: {type: String, required: true},
        subCategories: [{type: String, required: true}],
        tags: [{type: String}],
        active: {type: Boolean, default: true},
        expectedDeliveryDays: {type: Number, required: true},
        activeOrderCount: {type: Number, default: 0},
        ratingsCount: {type: Number, default: 0},
        ratingSum: {type: Number, default: 0},
        ratingCategories: {
            five: {value: {type: Number, default: 0}, count: {type: Number, default: 0}},
            four: {value: {type: Number, default: 0}, count: {type: Number, default: 0}},
            three: {value: {type: Number, default: 0}, count: {type: Number, default: 0}},
            two: {value: {type: Number, default: 0}, count: {type: Number, default: 0}},
            one: {value: {type: Number, default: 0}, count: {type: Number, default: 0}},
        },
        price: {type: Number, required: true},
        currency: {type: String, required: true, default: 'USD'},
        sortId: {type: Number},
        coverImage: {type: String, required: true},
        requirements: {type: [requirementQuestionSchema], default: []},
        isDeleted: {type: Boolean, default: false},
        deletedAt: {type: Date, default: null}
    },
    {
        versionKey: false,
        timestamps: true,
        toJSON: {
            transform(_doc: Document, ret: Record<string, unknown>) {
                ret.id = ret._id;
                delete ret._id;
                return ret;
            }
        }
    }
);

gigSchema.virtual('id').get(function () {
    return this._id;
});

const GigModel: Model<IGigDocument> = model<IGigDocument>('gigs', gigSchema);
export {GigModel};
