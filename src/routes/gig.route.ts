import express, {Router} from 'express';
import {gigController} from '@gigs/controllers/gig.controller';
import {
    RENDERABLE_IMAGE_ALLOWED_MIMES,
    handleAsyncError,
    validate,
    validateFile, BadRequestError,
} from '@hiep20012003/joblance-shared';
import {gigCreateSchema, gigUpdateSchema} from '@gigs/schemas/gig.schema';
import multer from 'multer';

class GigRoutes {
    private readonly router: Router;

    constructor() {
        this.router = express.Router();
    }

    public routes(): Router {
        const upload = multer({storage: multer.memoryStorage()});

        // ----------------------------
        // GET
        // ----------------------------
        this.router.get('/gigs/top', handleAsyncError(gigController.getTopGigs));
        this.router.get('/gigs/:gigId', handleAsyncError(gigController.getGigById));
        this.router.get('/gigs/:gigId/similar', handleAsyncError(gigController.getGigsSimilar));
        this.router.get('/sellers/:username/gigs', handleAsyncError(gigController.getAllGigsBySeller));
        this.router.get('/sellers/:username/gigs/active', handleAsyncError(gigController.getActiveGigsBySeller));
        this.router.get('/sellers/:username/gigs/inactive', handleAsyncError(gigController.getInactiveGigsBySeller)); // gigs inactive

        // ----------------------------
        // POST
        // ----------------------------
        this.router.post(
            '/gigs',
            upload.single('coverImageFile'),
            validateFile(RENDERABLE_IMAGE_ALLOWED_MIMES, 1024 * 1024 * 10, (file) => {
                if (!file) {
                    throw new BadRequestError({
                        clientMessage: 'Cover Image must be required',
                        operation: 'middleware:validate-body',
                    });
                }
            }),
            validate(gigCreateSchema),
            handleAsyncError(gigController.createGig)
        );

        // ----------------------------
        // PATCH
        // ----------------------------
        this.router.patch('/gigs/:gigId',
            upload.single('coverImageFile'),
            validateFile(RENDERABLE_IMAGE_ALLOWED_MIMES),
            validate(gigUpdateSchema),
            handleAsyncError(gigController.updateGig));

        this.router.patch('/gigs/:gigId/active',
            handleAsyncError(gigController.activeGig));

        this.router.patch('/gigs/:gigId/inactive',
            handleAsyncError(gigController.inactiveGig));

        // ----------------------------
        // DELETE
        // ----------------------------
        this.router.delete('/gigs/:gigId', gigController.deleteGig);

        return this.router;
    }
}

export const gigRoutes: GigRoutes = new GigRoutes();
