import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get list of inventory items with filter, search & pagination
   */
  async findAll(query: QueryInventoryDto) {
    const { category, search, page = 1, limit = 20 } = query;

    const where: Prisma.InventoryItemWhereInput = {};

    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { holderName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single inventory item by ID
   */
  async findOne(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }

    return item;
  }

  /**
   * Create new inventory item
   */
  async create(dto: CreateInventoryItemDto) {
    return this.prisma.inventoryItem.create({
      data: dto,
    });
  }

  /**
   * Update inventory item
   */
  async update(id: string, dto: UpdateInventoryItemDto) {
    await this.findOne(id);

    return this.prisma.inventoryItem.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete inventory item
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.inventoryItem.delete({
      where: { id },
    });
  }
}
