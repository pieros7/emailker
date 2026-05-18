import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './projects.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
  ) {}

  async findAll(): Promise<Project[]> {
    return this.projectsRepository.find();
  }

  async create(
    createdByUserId: string,
    dto: CreateProjectDto,
  ): Promise<Project> {
    const project = this.projectsRepository.create({
      ...dto,
      createdByUserId,
    });
    return this.projectsRepository.save(project);
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    const updatedProject = this.projectsRepository.merge(project, dto);
    return this.projectsRepository.save(updatedProject);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.projectsRepository.softDelete({ id });
  }

  async findEmails(projectId: string): Promise<[]> {
    await this.findOne(projectId);
    return [];
  }
}
