package com.rho.backend.repository;

import com.rho.backend.model.Text;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TextRepository extends JpaRepository<Text, Long> {

}
