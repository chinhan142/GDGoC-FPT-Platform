import { GetUser } from '../common/decorators/get-user.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { AddContributorDto } from './dto/add-contributor.dto';
import { AddContributorsDto } from './dto/add-contributors.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { HrEventGuard } from './guards/hr-event.guard';
@ApiTags('Events & Contributions')
@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly service: EventsService) {}
  @Get() findAll(@Query() query: QueryEventDto, @GetUser() user: any) {
    return this.service.findAll(query, user);
  }
  @Get('contributions/mine/count')
  myContributionCount(@GetUser('id') userId: string) { return this.service.myContributionCount(userId); }

  @Get(':id') findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: any,
  ) {
    return this.service.findOne(id, user);
  }
  @Post() @UseGuards(HrEventGuard) create(@Body() dto: CreateEventDto) {
    return this.service.create(dto);
  }
  @Put(':id') @UseGuards(HrEventGuard) update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.service.update(id, dto);
  }
  @Delete(':id') @UseGuards(HrEventGuard) @HttpCode(204) remove(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(id);
  }
  @Get(':id/contributors') getContributors(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: any,
  ) {
    return this.service.getContributors(id, user);
  }
  @Post(':id/contributors') @UseGuards(HrEventGuard) addContributor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddContributorDto,
  ) {
    return this.service.addContributor(id, dto);
  }
  @Post(':id/contributors/bulk') @UseGuards(HrEventGuard) addContributors(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddContributorsDto,
  ) {
    return this.service.addContributors(id, dto);
  }
  @Delete(':id/contributors/:userId')
  @UseGuards(HrEventGuard)
  @HttpCode(204)
  removeContributor(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.service.removeContributor(id, userId);
  }
  @Post(':id/settle-gems') @UseGuards(RolesGuard) @Roles(Role.LEAD) settleGems(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.settleGems(id);
  }
}
