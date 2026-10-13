package com.pm.docmindbackend.service;

import com.pm.docmindbackend.dto.DocumentMetadataDto;
import com.pm.docmindbackend.dto.DocumentResponseDto;
import com.pm.docmindbackend.entity.DocumentMetadata;
import com.pm.docmindbackend.entity.DocumentStatus;
import com.pm.docmindbackend.exception.DocumentProcessingException;
import com.pm.docmindbackend.exception.ResourceNotFoundException;
import com.pm.docmindbackend.repository.DocumentMetadataRepo;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.document.Document;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;


@Service
@RequiredArgsConstructor
public class DocumentMetadataService {

    private static final Logger log = LoggerFactory.getLogger(DocumentMetadataService.class);
    private final DocumentParserService parserService;
    private final ModelMapper modelMapper;
    private final DocumentIngestionService ingestionService;
    private final JdbcTemplate jdbcTemplate;

    //metod to upload and parse document
    private  final DocumentMetadataRepo documentMetadataRepo;

    @Transactional
    public DocumentResponseDto uploadAndProcess(MultipartFile file) {

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "Document";
        String contentType = file.getContentType() != null ? file.getContentType() : "application/octat-stram";

        DocumentMetadata documentMetadata = DocumentMetadata
                .builder()
                .filename(filename)
                .contentType(contentType)
                .status(DocumentStatus.UPLOADING)
                .fileSize(file.getSize())
                .createdAt(LocalDateTime.now())
                .build();

        //save the document meta data
        DocumentMetadata savedDocumentMetadata = documentMetadataRepo.save(documentMetadata);
        List<Document> parsedDocs = null;
        int chunksCreated = 0;

       try {
           //parse the file
           parsedDocs = parserService.parse(file);

           //ingest service
           chunksCreated = ingestionService.ingest(savedDocumentMetadata, parsedDocs);
       }
       catch (DocumentProcessingException e){

           log.info("Document meta data deleting due to fail processing");
           documentMetadataRepo.delete(documentMetadata);
           throw e;
       }

        //documentMetadata.setTotalChunks((chunksCreated));



        return DocumentResponseDto.builder()
                .id(documentMetadata.getId())
                .fileName(documentMetadata.getFilename())
                .fileSize(documentMetadata.getFileSize())
                .chunksCreated(chunksCreated)
                .status(documentMetadata.getStatus())
                .message("Document successfully processed and indexed.")
                .build();
    }

    public List<DocumentResponseDto> uploadMultipleDocuments(List<MultipartFile> files) {

        List<DocumentResponseDto> responseDtos = new ArrayList<>();

        for (MultipartFile file:files){

            DocumentResponseDto result = this.uploadAndProcess(file);
            responseDtos.add(result);

        }

        return responseDtos;
    }

    public List<DocumentMetadataDto> getAllDocuments() {

        List<DocumentMetadata> allDocuments = documentMetadataRepo.findAllByOrderByCreatedAtDesc();
        return allDocuments.stream()
                .map(documentMetadata -> modelMapper.map(documentMetadata, DocumentMetadataDto.class))
                .toList();

    }


    public DocumentMetadataDto getDocumentById(UUID id) {
        DocumentMetadata documentMetadata = documentMetadataRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Document with given id not found !!"));
        return modelMapper.map(documentMetadata, DocumentMetadataDto.class);
    }

    @Transactional
    public void deleteDocument(UUID id) {
        DocumentMetadata documentMetadata = documentMetadataRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Document with given id not found !!"));

        documentMetadataRepo.delete(documentMetadata);
        //delete the vector entries
        try {
            String deleteVectorsSql = "DELETE FROM vector_store WHERE metadata->>'documentId' = ?";
            int deletedCount = jdbcTemplate.update(deleteVectorsSql, id.toString());
            log.info("Deleted {} vector chunks for document id {} ", deletedCount, id);

        } catch (Exception e) {
            log.warn("cloud not delete vectors from vector store directly: {}", e.getMessage());
        }

    }
}
