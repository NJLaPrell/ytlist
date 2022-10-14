import { HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { catchError, map, mergeMap, of } from "rxjs";
import { VideoService } from "src/app/services/video.service";
import * as VideoActions from '../actions/video.actions';
import { Video } from "../models/video.model";


@Injectable()
export class VideoEffects {

    getChannelVideos$ = createEffect(() => this.actions$.pipe(
        ofType(VideoActions.getChannelVideos),
        mergeMap((action) => this.videoService.getChannelVideos(action.channelId).pipe(
            map((response: Video[]) => VideoActions.getChannelVideosSuccess({ response, channelId: action.channelId })),
            catchError((error: HttpErrorResponse) => of(VideoActions.getChannelVideosFail({ error: error.message })))
        ))
    ));

    getPlaylistVideos$ = createEffect(() => this.actions$.pipe(
        ofType(VideoActions.getPlaylistVideos),
        mergeMap((action) => this.videoService.getPlaylistVideos(action.playlistId).pipe(
            map((response: Video[]) => VideoActions.getPlaylistVideosSuccess({ response, playlistId: action.playlistId })),
            catchError((error: HttpErrorResponse) => of(VideoActions.getPlaylistVideosFail({ error: error.message })))
        ))
    ));

    constructor(
        private actions$: Actions,
        private videoService: VideoService
    ) { }
}