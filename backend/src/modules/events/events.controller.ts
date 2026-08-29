import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AddEventOrganizerDto } from './dto/add-event-organizer.dto';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an event' })
  @ApiCreatedResponse({ description: 'The event was created successfully.' })
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(createEventDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all events' })
  @ApiOkResponse({ description: 'All events were returned successfully.' })
  findAll() {
    return this.eventsService.findAll();
  }

  @Post(':eventId/organizers/settle-gems')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Settle Gems for an event’s organizers',
    description:
      'Rewards organizers who have not received Gems yet. Already rewarded organizers are skipped, so repeated calls do not grant Gems twice.',
  })
  @ApiParam({ name: 'eventId', type: String, format: 'uuid' })
  @ApiOkResponse({
    description: 'Organizer Gems were settled successfully.',
    schema: {
      example: {
        eventId: '123e4567-e89b-12d3-a456-426614174000',
        rewardedCount: 2,
        skippedCount: 1,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Event not found.' })
  settleOrganizerGems(@Param('eventId', new ParseUUIDPipe()) eventId: string) {
    return this.eventsService.settleOrganizerGems(eventId);
  }

  @Post(':eventId/organizers')
  @ApiOperation({ summary: 'Assign an organizer to an event' })
  @ApiParam({ name: 'eventId', type: String, format: 'uuid' })
  @ApiCreatedResponse({
    description: 'The organizer was assigned successfully.',
  })
  @ApiBadRequestResponse({
    description:
      'The department is not professional or the user does not belong to it for the event tenure.',
  })
  @ApiNotFoundResponse({ description: 'Event, user, or department not found.' })
  @ApiConflictResponse({
    description: 'The user is already an organizer for this event.',
  })
  addOrganizer(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body() addEventOrganizerDto: AddEventOrganizerDto,
  ) {
    return this.eventsService.addOrganizer(eventId, addEventOrganizerDto);
  }

  @Get(':eventId/organizers')
  @ApiOperation({ summary: 'Get all organizers assigned to an event' })
  @ApiParam({ name: 'eventId', type: String, format: 'uuid' })
  @ApiOkResponse({
    description: 'The event organizers were returned successfully.',
  })
  @ApiNotFoundResponse({ description: 'Event not found.' })
  findOrganizers(@Param('eventId', new ParseUUIDPipe()) eventId: string) {
    return this.eventsService.findOrganizers(eventId);
  }

  @Delete(':eventId/organizers/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an organizer from an event' })
  @ApiParam({ name: 'eventId', type: String, format: 'uuid' })
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  @ApiNoContentResponse({
    description: 'The organizer assignment was removed successfully.',
  })
  @ApiNotFoundResponse({ description: 'Organizer assignment not found.' })
  async removeOrganizer(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    await this.eventsService.removeOrganizer(eventId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an event by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'The event was returned successfully.' })
  @ApiNotFoundResponse({ description: 'Event not found.' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an event by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'The event was updated successfully.' })
  @ApiNotFoundResponse({ description: 'Event not found.' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, updateEventDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an event by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'The event was deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Event not found.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.eventsService.remove(id);
  }
}
