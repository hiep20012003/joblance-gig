import {SuccessResponse, ISearchParams} from '@hiep20012003/joblance-shared';
import {gigService} from '@gigs/services/gig.service';
import {Request, Response} from 'express';
import {ReasonPhrases, StatusCodes} from 'http-status-codes';
import {GigCreateDTO, GigUpdateDTO} from '@gigs/schemas/gig.schema';

class GigController {
    search = async (req: Request, res: Response): Promise<void> => {
        const payload = req.body as ISearchParams;
        const searchResponse = await gigService.search(payload);
        new SuccessResponse({
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
            data: {...searchResponse}
        }).send(res);
    };

    createGig = async (req: Request, res: Response): Promise<void> => {
        const payload = {...req.body} as GigCreateDTO;
        const gig = await gigService.createGig(payload, req.file);
        new SuccessResponse({
            message: 'Gig created successfully',
            statusCode: StatusCodes.CREATED,
            reasonPhrase: ReasonPhrases.CREATED,
            data: gig
        }).send(res);
    };

    updateGig = async (req: Request, res: Response): Promise<void> => {
        const payload = req.body as GigUpdateDTO;
        const gig = await gigService.updateGig(req.params.gigId, payload, req.file);
        new SuccessResponse({
            message: 'Gig updated successfully',
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
            data: gig
        }).send(res);
    };

    inactiveGig = async (req: Request, res: Response): Promise<void> => {
        const gig = await gigService.updateGigStatus(req.params.gigId, false);
        new SuccessResponse({
            message: 'Gig active status updated successfully',
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
            data: gig
        }).send(res);
    };

    activeGig = async (req: Request, res: Response): Promise<void> => {
        const gig = await gigService.updateGigStatus(req.params.gigId, true);
        new SuccessResponse({
            message: 'Gig active status updated successfully',
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
            data: gig
        }).send(res);
    };

    deleteGig = async (req: Request, res: Response): Promise<void> => {
        await gigService.deleteGig(req.params.gigId);
        new SuccessResponse({
            message: 'Gig deleted successfully',
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK
        }).send(res);
    };

    getGigById = async (req: Request, res: Response): Promise<void> => {
        const gig = await gigService.getGigById(req.params.gigId);
        new SuccessResponse({
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
            data: gig
        }).send(res);
    };

    getAllGigsBySeller = async (req: Request, res: Response): Promise<void> => {
        const gigs = await gigService.getAllGigsBySellerUsername(req.params.username);
        new SuccessResponse({
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
            data: gigs
        }).send(res);
    };

    getActiveGigsBySeller = async (req: Request, res: Response): Promise<void> => {
        const gigs = await gigService.getActiveGigsBySellerUsername(req.params.username);
        new SuccessResponse({
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
            data: gigs
        }).send(res);
    };

    getInactiveGigsBySeller = async (req: Request, res: Response): Promise<void> => {
        const gigs = await gigService.getInactiveGigsBySellerUsername(req.params.username);
        new SuccessResponse({
            message: 'Seller inactive gigs',
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
            data: gigs
        }).send(res);
    };


    getGigsSimilar = async (req: Request, res: Response): Promise<void> => {
        const gigs = await gigService.getGigsSimilar(req.params.gigId);
        new SuccessResponse({
            message: 'Similar gigs',
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
            data: gigs
        }).send(res);
    };

    getTopGigs = async (req: Request, res: Response): Promise<void> => {
        const gigs = await gigService.getTopGigs(req.query);
        new SuccessResponse({
            message: 'Similar gigs',
            statusCode: StatusCodes.OK,
            reasonPhrase: ReasonPhrases.OK,
            data: gigs
        }).send(res);
    };
}

export const gigController: GigController = new GigController();
