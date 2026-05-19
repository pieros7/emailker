import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Email } from './emails.entity';
import { CreateEmailDto } from './dto/create-email.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { EmailStatus } from './enums/email-status.enum';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class EmailsService {
  constructor(
    @InjectRepository(Email)
    private emailsRepository: Repository<Email>,
    private projectsService: ProjectsService,
  ) {}

  async create(createEmailDto: CreateEmailDto): Promise<Email> {
    // Verifies that the project exists, throws NotFoundException if not.
    await this.projectsService.findOne(createEmailDto.idProyecto);

    const email = this.emailsRepository.create({
      ...createEmailDto,
      estado: EmailStatus.BORRADOR,
    });

    return this.emailsRepository.save(email);
  }

  async findById(id: string): Promise<Email> {
    const email = await this.emailsRepository.findOne({
      where: { idCorreo: id },
    });
    if (!email) {
      throw new NotFoundException(`Email with ID ${id} not found`);
    }
    return email;
  }

  async update(id: string, updateEmailDto: UpdateEmailDto): Promise<Email> {
    const email = await this.findById(id);
    const updatedEmail = this.emailsRepository.merge(email, updateEmailDto);
    return this.emailsRepository.save(updatedEmail);
  }

  async softDelete(id: string): Promise<void> {
    await this.findById(id);
    await this.emailsRepository.softDelete({ idCorreo: id });
  }
}
