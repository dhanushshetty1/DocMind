package com.pm.docmindbackend.dto;


import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.UUID;


@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SearchRequestDto {

    @NotBlank(message = "Query cant be empty")
    private String query;

    private UUID documentId;

    private Integer topK;

    private Double similaritySearch;

}
